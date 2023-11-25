import { DEFAULT_SQL_DATABASE_PROMPT, SqlDatabaseChainInput } from "langchain/chains/sql_db";
import { RunnableSequence } from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";
import { SqlDatabase } from "langchain/sql_db";
import { BaseLanguageModel } from "langchain/dist/base_language";
import { BaseChain } from "langchain/chains";
import { ChainValues } from "langchain/schema";
import { CallbackManagerForChainRun } from "langchain/callbacks";
import { PromptTemplate } from "langchain/prompts";

const CONTEXTUAL_ERROR = 'There is no specific information in the provided SQL table schema';

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
  
    sqlOutputKey: string | undefined = undefined;
  
    // Whether to return the result of querying the SQL table directly.
    returnDirect = false;

  constructor(fields: SqlDatabaseChainInput) {
    super(fields);
    this.llm = fields.llm;
    this.database = fields.database;
    this.topK = fields.topK ?? this.topK;
    this.inputKey = fields.inputKey ?? this.inputKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.sqlOutputKey = fields.sqlOutputKey ?? this.sqlOutputKey;
    this.prompt = fields.prompt;
  }

  async _call(values: ChainValues, runManager?: CallbackManagerForChainRun): Promise<ChainValues> {
    const question: string = values[this.inputKey];

    const prompt =
    PromptTemplate.fromTemplate(`Based on the provided SQL table schema below, write a SQL query that would answer the user's question.
    ------------
    SCHEMA: {schema}
    ------------
    QUESTION: {question}
    ------------
    SQL QUERY:`);

    const sqlQueryChain = RunnableSequence.from([
      {
        schema: async () => this.database.getTableInfo(),
        question: (input: { question: string }) => input.question,
      },
      prompt,
      this.llm.bind({ stop: ["\nSQLResult:"] })
    ]);

    const responsePrompt =
    PromptTemplate.fromTemplate(`Based on the table schema below, question, SQL query, and SQL response, write a natural language response:
    ------------
    SCHEMA: {schema}
    ------------
    QUESTION: {question}
    ------------
    SQL QUERY: {query}
    ------------
    SQL RESPONSE: {response}`);

    const finalChain = RunnableSequence.from([
      {
        question: (input) => input.question,
        query: sqlQueryChain,
      },
      {
        schema: async () => this.database.getTableInfo(),
        question: (input) => input.question,
        query: (input) => input.query,
        response: (input) => {
          if (input.query.content.includes(CONTEXTUAL_ERROR)) return null;

          return this.database.run(input.query)
        },
      },
      {
        [this.outputKey]: responsePrompt.pipe(this.llm).pipe(new StringOutputParser()),
        [this.sqlOutputKey]: (previousStepResult) => previousStepResult.query,
      },
    ]);

    return finalChain.invoke({ question });
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
