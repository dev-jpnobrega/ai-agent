import { exec } from 'child_process';

import * as zod from 'zod';
import { JsonSpec } from '@langchain/classic/tools';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StructuredTool, tool } from '@langchain/core/tools';

import { ICapability } from '.';
import { IDataSourceConfig } from '../../interface/agent.interface';
import { SqlDatabase } from '@langchain/classic/sql_db';

const DENY_RE =
  /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|REPLACE|TRUNCATE)\b/i;
const HAS_LIMIT_TAIL_RE = /\blimit\b\s+\d+(\s*,\s*\d+)?\s*;?\s*$/i;

const CAPABILITY_NAME = 'sql-tool';

const CAPABILITY_DESCRIPTION = `
This tool MUST be used to execute SQL queries against a database.
Given a user question, it generates the appropriate SQL query and executes it.

Rules:
- ALWAYS use this tool when the user asks to interact with the database
- The tool will generate and execute the correct SQL query based on the schema
- DO NOT attempt to execute SQL queries directly without using this tool

Input:
- question: a clear description of what SQL operation the user wants to perform

Examples:
- "List all users" → generates SELECT * FROM users;
- "Create a new product with name Test" → generates INSERT INTO products (name) VALUES ('Test');

Returns:
- The result of the executed SQL query
`;

const CAPABILITY_SCHEMA = zod.object({
  question: zod
    .string()
    .describe(
      'A clear description of what SQL operation the user wants to perform',
    ),
  user_context: zod
    .string()
    .describe(
      'Additional context about the user or the question that can help generate the SQL query',
    )
    .optional(),
});

class SQLCapability implements ICapability {
  name: string;
  description: string;
  schema: zod.ZodObject<any>;

  private _settings: IDataSourceConfig;
  private _llm: BaseLanguageModel;
  private _tool: StructuredTool;
  private _dataSourceInstance?: SqlDatabase;

  constructor(settings: IDataSourceConfig, llm: BaseLanguageModel) {
    this.name = CAPABILITY_NAME;
    this.description = CAPABILITY_DESCRIPTION;
    this.schema = CAPABILITY_SCHEMA;
    this._settings = settings;
    this._llm = llm;
  }

  private getSqlPrompt(): string {
    return `
      Based on the SQL table schema provided below, write an SQL query that answers the user's question.\n
      Your response must only be a valid SQL query, based on the schema provided.\n
      Remember to put double quotes around database table names.\n
      -------------------------------------------\n
      
      ## Follow these rules to generate the sql query:\n
        1. Generate only the SQL query: Output only the executable SQL query, without any additional explanation or context.\n
        2. Do not use data from the example rows, they are just demonstration rows over the data.\n
   
      USER CONTEXT:\n
        CONTEXT: {user_context}\n
        USER INSTRUCTIONS: {user_prompt}\n
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

  private async getDataSourceInstance(): Promise<SqlDatabase> {
    try {
      this._dataSourceInstance =
        this._dataSourceInstance ||
        (await SqlDatabase.fromDataSourceParams({
          appDataSource: this._settings.dataSource,
          ...this._settings,
        }));

      this._dataSourceInstance = this._dataSourceInstance;

      return this._dataSourceInstance;
    } catch (error) {
      throw new Error(`Failed to connect to the database: ${error.message}`);
    }
  }

  private getPrompt(): ChatPromptTemplate {
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(this.getSqlPrompt()),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ]);

    return prompt;
  }

  private async generateSQL(
    question: string,
    user_context?: string,
  ): Promise<string> {
    const dataSource = await this.getDataSourceInstance();
    const schema = await dataSource.getTableInfo(
      this._settings?.includesTables,
    );

    const prompt = this.getPrompt();

    const chain = prompt.pipe(this._llm);

    const result = await chain.invoke({
      schema,
      question,
      user_prompt: this._settings?.customizeSystemMessage, // TODO
      user_context: user_context || '',
    });

    return (result as any).content || String(result);
  }

  private sanitizeSQL(q: string): string {
    let query = String(q ?? '').trim();

    const semis = [...query].filter((c) => c === ';').length;
    if (
      semis > 1 ||
      (query.endsWith(';') && query.slice(0, -1).includes(';'))
    ) {
      throw new Error('multiple statements are not allowed.');
    }

    query = query.replace(/;+\s*$/g, '').trim();

    if (DENY_RE.test(query)) {
      throw new Error(
        'DML/DDL detected. Only read-only queries are permitted.',
      );
    }

    if (!HAS_LIMIT_TAIL_RE.test(query)) {
      query += ` LIMIT ${this._settings?.maxResult || 50}`;
    }

    return query;
  }

  private async executeQuery(query: string): Promise<string> {
    try {
      const dataSource = await this.getDataSourceInstance();
      const result = await dataSource.run(query);

      return result;
    } catch (error) {
      return `Failed to execute query: ${error.message}\nQuery: ${query}`;
    }
  }

  async func(input: Record<string, any>): Promise<any> {
    const { question, user_context } = input;

    const query = await this.generateSQL(question, user_context);
    const sanitizedQuery = this.sanitizeSQL(query);

    const result = await this.executeQuery(sanitizedQuery);

    return result;
  }

  getTool(): StructuredTool {
    if (this._tool) return this._tool;

    this._tool = tool(this.func.bind(this), {
      name: this.name,
      description: this.description,
      schema: this.schema,
    });

    return this._tool;
  }
}

export default SQLCapability;
