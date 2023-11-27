import { BaseChain } from 'langchain/chains';
import { IDataSourceConfig } from '../../interface/agent.interface';
import SqlDatabaseChain from './sql-database-chain';
import { SqlDatabase } from 'langchain/sql_db';
import { BaseChatModel } from 'langchain/chat_models/base';
import { PromptTemplate } from 'langchain/prompts';

const SYSTEM_MESSAGE_DEFAULT = `
  Given an input question, first create a syntactically correct postgres query to be performed, then execute a query after observing the query results and return the answer.\n
  Never query all columns in a table. You should only query the possible columns to answer the question. Enclose each column name in double quotation marks (") to denote the delimited identifiers.\n
  Pay attention to only use the column names that you can see in the tables below. Be careful not to query columns that don't exist. Also, pay attention to which column is in which table.\n
  \n
  Use the following format:\n
  SCHEMA: {schema}
  ------------
  QUESTION: {question}
  ------------
  SQL QUERY: {query}
  ------------
  SQL RESPONSE: {response}
  \n\n
`;

class SqlChain {
  private _settings: IDataSourceConfig;
  private _dataSourceInstance: SqlDatabase;
  
  constructor(settings: IDataSourceConfig) {
    this._settings = settings;
  }

  private getSystemMessage(): string { 
    return SYSTEM_MESSAGE_DEFAULT.concat(this._settings?.customizeSystemMessage || '');
  }

  private async getDataSourceInstance(): Promise<SqlDatabase> {
    // TODO: define db a singleton ou instance
    this._dataSourceInstance = this._dataSourceInstance || await SqlDatabase.fromDataSourceParams({
      appDataSource: this._settings.dataSource,
      ...this._settings,
    });

    this._dataSourceInstance = this._dataSourceInstance;

    return this._dataSourceInstance;
  }

  public async create(llm: BaseChatModel, ...args: any): Promise<BaseChain> {
    const database = await this.getDataSourceInstance();
    const systemTemplate = this.getSystemMessage();

    const chainSQL =  new SqlDatabaseChain({
      llm,
      database,
      outputKey: 'sqlResult',
      sqlOutputKey: 'sqlQuery',
      prompt: new PromptTemplate({
        inputVariables: ['question', 'response', 'schema', 'query'],
        template: systemTemplate,
      }),
    }, this._settings?.customizeSystemMessage);

    return chainSQL;
  }
}

export default SqlChain;