import { BaseChatMessageHistory } from 'langchain/schema';
import { IDatabaseConfig } from '../../interface/agent.interface';

class RedisChatHistory {
  private _settings: IDatabaseConfig;
  private _redisClientInstance: any;

  constructor(settings: IDatabaseConfig) {
    this._settings = settings;
  }

  private async createClient(): Promise<any> {
    if (this._redisClientInstance) {
      return this._redisClientInstance;
    };

    const { Redis } = (await import('ioredis'));

    const options = (!this._settings?.ssl) ? {
      ...this._settings,
      db: this._settings.database as number,
    } : {
      ...this._settings,
      db: this._settings.database as number,
      tls: {}
    }

    const client = new Redis(options);

    this._redisClientInstance = client;

    return this._redisClientInstance;
  }
 
  async build(): Promise<BaseChatMessageHistory> {
    const { RedisChatMessageHistory } = (await import('langchain/stores/message/ioredis'));

    const client = await this.createClient();

    return new RedisChatMessageHistory({
      sessionTTL: this._settings.sessionTTL,
      sessionId: this._settings.sessionId || new Date().toISOString(),
      client,
    });
  }
}

export default RedisChatHistory;