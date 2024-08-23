import { BaseChain } from 'langchain/chains';
import { IDataSourceConfig } from '../../interface/agent.interface';
import SqlDatabaseChain from './sql-database-chain';
import { SqlDatabase } from 'langchain/sql_db';
import { BaseChatModel } from 'langchain/chat_models/base';
import { PromptTemplate } from 'langchain/prompts';
import { IChain } from './';

const SYSTEM_MESSAGE_DEFAULT = `Based on the table schema below, question, SQL query, and SQL response, write a natural language response:
------------\n
SCHEMA: {schema}\n
------------\n
QUESTION: {question}\n
------------\n
SQL QUERY: {query}\n
------------\n
SQLResult: {response}\n
------------\n
NATURAL LANGUAGE RESPONSE:`;

class SqlChain implements IChain {
  private _settings: IDataSourceConfig;
  private _dataSourceInstance: SqlDatabase;
  
  constructor(settings: IDataSourceConfig) {
    this._settings = settings;
  }

  private getSystemMessage(): string { 
    return SYSTEM_MESSAGE_DEFAULT.concat(this._settings?.customizeSystemMessage || '');
  }

  private async getDataSourceInstance(): Promise<SqlDatabase> {
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
        inputVariables: ['question', 'response', 'schema', 'query', 'chat_history', 'max_result'],
        template: systemTemplate,
      }),
    }, this._settings?.customizeSystemMessage);

    return chainSQL;
  }
}

export default SqlChain;