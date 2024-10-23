import { BaseLanguageModel } from '@langchain/core/language_models/base';

import { SqlDatabase } from 'langchain/sql_db';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  AIMessagePromptTemplate,
  BasePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';

const MESSAGES_ERRORS = {
  dataTooBig: 'Data result is too big. Please, be more specific.',
  dataEmpty: 'Data result is empty.',
  dataError: 'Data result is error. Please, try again.',
};

export interface SqlDatabaseChainInput {
  llm: BaseLanguageModel;
  database: SqlDatabase;
  topK?: number;
  inputKey?: string;
  outputKey?: string;
  sqlOutputKey?: string;
  prompt?: PromptTemplate;
}

class SqlDatabaseChain {
  // LLM wrapper to use
  llm: BaseLanguageModel;

  // SQL Database to connect to.
  database: SqlDatabase;

  // Prompt to use to translate natural language to SQL.
  prompt;

  // Number of results to return from the query
  topK = 5;

  inputKey = 'query';

  outputKey = 'result';

  customMessage = '';

  sqlOutputKey: string | undefined = undefined;

  // Whether to return the result of querying the SQL table directly.
  returnDirect = false;

  includeTables: string[] = [];

  constructor(
    fields: SqlDatabaseChainInput,
    customMessage?: string,
    includeTables?: string[]
  ) {
    this.llm = fields.llm;
    this.database = fields.database;
    this.topK = fields.topK ?? this.topK;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.sqlOutputKey = fields.sqlOutputKey ?? this.sqlOutputKey;
    this.prompt = fields.prompt;
    this.customMessage = customMessage || '';
    this.includeTables = includeTables || [];
  }

  //TODO: rever se vai ser necessário colocar o context aqui tbm
  getSQLPrompt(): string {
    return `
      Based on the SQL table schema provided below, write an SQL query that answers the user's question.\n
      Your response must only be a valid SQL query, based on the schema provided.\n
      Remember to put double quotes around database table names.\n
      -------------------------------------------\n
      Here are some important observations for generating the query:\n
      - Do not use data from the example rows, they are just demonstration rows over the data.\n
   
      USER CONTEXT:\n
        USER RULES: {user_prompt}\n
        CONTEXT: {user_context}\n
      -------------------------------------------\n
      CHAT HISTORY:\n
      {format_chat_messages}\n
      -------------------------------------------\n
      DATA SCHEMA AND ROWS EXAMPLE: \n
      {schema}\n
      -------------------------------------------\n
      QUESTION:\n
      {question}\n
      ------------------------------------------\n      
      SQL QUERY:
    `;
  }

  parserSQL(sql: string) {
    const sqlL = sql.toLowerCase();

    if (
      sqlL.startsWith('select') ||
      sqlL.startsWith('update') ||
      sqlL.startsWith('delete') ||
      sqlL.startsWith('insert')
    ) {
      return sql;
    }

    if (sqlL.includes('```sql')) {
      const regex = /```(.*?)```/gs;
      const matches = [...sqlL.matchAll(regex)];
      const codeBlocks = matches.map((match) => match[1]);
      const sqlBlock = codeBlocks[0].replace('sql', '');

      return sqlBlock;
    }
    return;
  }

  // TODO: check implementation for big data
  private async checkResultDatabase(database: SqlDatabase, sql: string) {
    const prepareSql = sql.replace(';', '');
    const prepareCount = `SELECT COUNT(*) as resultCount FROM (${prepareSql}) as tableCount;`;
    let result = 0;

    try {
      const countResult = await database.run(prepareCount);

      const data = JSON.parse(countResult);
      result = parseInt(data[0]?.resultcount, 10);
    } catch (error) {
      console.error(error);
      throw new Error(MESSAGES_ERRORS.dataError);
    }

    if (result === 0) {
      throw new Error(MESSAGES_ERRORS.dataEmpty);
    }

    if (result >= this.topK) {
      throw new Error(MESSAGES_ERRORS.dataTooBig);
    }

    return result;
  }

  private buildPromptTemplate(systemMessages: string): BasePromptTemplate {
    const combine_messages = [
      SystemMessagePromptTemplate.fromTemplate(systemMessages),
      new MessagesPlaceholder('history'),
      AIMessagePromptTemplate.fromTemplate(
        'Wait! We are searching our database.'
      ),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ];

    const CHAT_COMBINE_PROMPT =
      ChatPromptTemplate.fromMessages(combine_messages);

    return CHAT_COMBINE_PROMPT;
  }

  private async buildSqlQueryChain(
    tableSchema: string
  ): Promise<RunnableSequence<any, any>> {
    const prompt = this.buildPromptTemplate(this.getSQLPrompt());

    const sqlQueryChain = RunnableSequence.from([
      {
        schema: () => tableSchema,
        question: (input) => input.question,
        user_prompt: (input) => this.customMessage,
        history: (input) => input.history,
        user_context: (input) => input.user_context,
        format_chat_messages: (input) => input.format_chat_messages,
      },
      prompt,
      this.llm.bind({ stop: ['\nSQLResult:'] }),
    ]);

    return sqlQueryChain;
  }

  private async executeSQLQuery(input: any) {
    const text = input?.query?.content;

    try {
      const sqlParserd = this.parserSQL(text);

      if (!sqlParserd) return text;

      await this.checkResultDatabase(this.database, sqlParserd);

      const queryResult = await this.database.run(sqlParserd);

      return queryResult;
    } catch (error) {
      console.error(error);

      return error?.message;
    }
  }

  async build(...args: any): Promise<RunnableSequence<any, any>> {
    const tableSchema = await this.database.getTableInfo(this.includeTables);
    const sqlQueryChain = await this.buildSqlQueryChain(tableSchema);

    const sqlChain = RunnableSequence.from([
      {
        question: (input: any) => input.question,
        user_prompt: (input: any) => this.customMessage,
        history: (input: any) => input.history,
        user_context: (input: any) => input.user_context,
        format_chat_messages: (input) => input.format_chat_messages,
        query: sqlQueryChain,
      },
      {
        schema: () => tableSchema,
        user_prompt: () => this.customMessage,
        user_context: (input: any) => input.user_context,
        history: (input: any) => input.history,
        question: (input: any) => input.question,
        query: (input: any) => input.query,
        format_chat_messages: (input) => input.format_chat_messages,
        response: this.executeSQLQuery.bind(this),
      },
      {
        [this.outputKey]: this.prompt
          .pipe(this.llm)
          .pipe(new StringOutputParser()),
        [this.sqlOutputKey]: (previousStepResult: any) => {
          return previousStepResult?.query?.content;
        },
      },
    ]);

    return sqlChain;
  }
}

export default SqlDatabaseChain;
