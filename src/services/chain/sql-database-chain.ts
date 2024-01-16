import { DEFAULT_SQL_DATABASE_PROMPT, SqlDatabaseChainInput } from "langchain/chains/sql_db";
import { RunnableSequence } from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";
import { SqlDatabase } from "langchain/sql_db";
import { BaseLanguageModel } from "langchain/dist/base_language";
import { BaseChain } from "langchain/chains";
import { ChainValues } from "langchain/schema";
import { CallbackManagerForChainRun } from "langchain/callbacks";
import { PromptTemplate } from "langchain/prompts";


const MESSAGES_ERRORS = {
  dataTooBig: 'Data result is too big. Please, be more specific.',
  dataEmpty: 'Data result is empty. Please, be more specific.',
}

/**
 * Class that represents a SQL database chain in the LangChain framework.
 * It extends the BaseChain class and implements the functionality
 * specific to a SQL database chain.
 *
 * @security **Security Notice**
 * This chain generates SQL queries for the given database.
 * The SQLDatabase class provides a getTableInfo method that can be used
 * to get column information as well as sample data from the table.
 * To mitigate risk of leaking sensitive data, limit permissions
 * to read and scope to the tables that are needed.
 * Optionally, use the includesTables or ignoreTables class parameters
 * to limit which tables can/cannot be accessed.
 *
 * @link See https://js.langchain.com/docs/security for more information.
 * @example
 * ```typescript
 * const chain = new SqlDatabaseChain({
 *   llm: new OpenAI({ temperature: 0 }),
 *   database: new SqlDatabase({ ...config }),
 * });
 *
 * const result = await chain.run("How many tracks are there?");
 * ```
 */
export default class SqlDatabaseChain extends BaseChain {
  // LLM wrapper to use
  llm: BaseLanguageModel;

  // SQL Database to connect to.
  database: SqlDatabase;

  // Prompt to use to translate natural language to SQL.
  prompt = DEFAULT_SQL_DATABASE_PROMPT;

  // Number of results to return from the query
  topK = 5;

  inputKey = "query";

  outputKey = "result";

  customMessage = '';

  maxDataExamples = 10; // TODO add config in agent settings

  sqlOutputKey: string | undefined = undefined;

  // Whether to return the result of querying the SQL table directly.
  returnDirect = false;

  constructor(fields: SqlDatabaseChainInput, customMessage?: string) {
    super(fields);
    this.llm = fields.llm;
    this.database = fields.database;
    this.topK = fields.topK ?? this.topK;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.sqlOutputKey = fields.sqlOutputKey ?? this.sqlOutputKey;
    this.prompt = fields.prompt;
    this.customMessage = customMessage || '';
  }

  getSQLPrompt(): PromptTemplate { 
    return PromptTemplate.fromTemplate(`
      Based on the SQL table schema provided below, write an SQL query that answers the user's question.\n
      Your response must only be a valid SQL query, based on the schema provided.\n
      -------------------------------------------\n
      Here are some important observations for generating the query:\n
      ${this.customMessage}\n
      -------------------------------------------\n
      SCHEMA: {schema}\n
      -------------------------------------------\n
      QUESTION: {question}\n
      ------------------------------------------\n
      SQL QUERY:
    `);
  }


  parserSQL(sql: string) {
    const sqlL = sql.toLowerCase();

    if (sqlL.startsWith('select') || sqlL.startsWith('update') || sqlL.startsWith('delete') || sqlL.startsWith('insert')) {
      return sql;
    }

    if (sqlL.includes('```sql')) {
      const regex = /```(.*?)```/gs;
      const matches = [...sqlL.matchAll(regex)];
      const codeBlocks = matches.map(match => match[1]);
      const sqlBlock = codeBlocks[0].replace('sql', '');

      return sqlBlock;
    }

    throw new Error(MESSAGES_ERRORS.dataEmpty);
  }

  private async checkResultDatabase(database: SqlDatabase, sql: string) {
    const prepareSql = sql.replace(';', '');
    const prepareCount = `SELECT COUNT(*) as resultCount FROM (${prepareSql}) as tableCount;`;
    
    try {
      const countResult = await database.run(prepareCount);

      const data = JSON.parse(countResult);
      const result = parseInt(data[0]?.resultcount, 10);

      if (result >= this.maxDataExamples) {
        throw new Error(MESSAGES_ERRORS.dataTooBig);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async _call(values: ChainValues, runManager?: CallbackManagerForChainRun): Promise<ChainValues> {
    const question: string = values[this.inputKey];
    const table_schema = await this.database.getTableInfo();

    const sqlQueryChain = RunnableSequence.from([
      {
        schema: () => table_schema,
        question: (input: { question: string }) => input.question,
      },
      this.getSQLPrompt(),
      this.llm.bind({ stop: ["\nSQLResult:"] })
    ]);

    const finalChain = RunnableSequence.from([
      {
        question: (input) => input.question,
        query: sqlQueryChain,
      },
      {
        table_info: () => table_schema,
        input: () => question,
        schema: () => table_schema,
        question: (input) => input.question,
        query: (input) => input.query,
        response: async (input) => {
          const sql = input.query.content;

          try {
            const sqlParserd = this.parserSQL(sql);

            if (!sqlParserd) return null;

            console.log(`SQL`, sqlParserd);

            await this.checkResultDatabase(this.database, sqlParserd);

            const queryResult = await this.database.run(sqlParserd);

            return queryResult;
          } catch (error) { 
            console.error(error);

            return error?.message;
          }
        },
      },
      {
        [this.outputKey]: this.prompt.pipe(this.llm).pipe(new StringOutputParser()),
        [this.sqlOutputKey]: (previousStepResult) => {
          return previousStepResult?.query?.content;
        },
      },
    ]);

    const result = await finalChain.invoke({ question });

    return result;
  }

  _chainType(): string {
    return "sql_chain" as const;
  }

  get inputKeys(): string[] {
    return [this.inputKey];
  }

  get outputKeys(): string[] {
    if (this.sqlOutputKey != null) {
      return [this.outputKey, this.sqlOutputKey];
    }
    return [this.outputKey];
  }  
}
