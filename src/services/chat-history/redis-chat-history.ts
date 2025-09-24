import { BaseListChatMessageHistory } from '@langchain/core/chat_history';
import Redis from 'ioredis';
import { RedisChatMessageHistory } from '@langchain/community/stores/message/ioredis';

import { BaseMessage } from '@langchain/core/messages';
import { IDatabaseConfig } from '../../interface/agent.interface';
import { IChatHistory } from '.';

class RedisChatHistory implements IChatHistory {
  private _settings: IDatabaseConfig;
  private _redisClientInstance: any;
  private _history: BaseListChatMessageHistory;

  constructor(settings: IDatabaseConfig) {
    this._settings = settings;
  }

  private async createClient(): Promise<any> {
    if (this._redisClientInstance) {
      return this._redisClientInstance;
    }

    const client = new Redis({
      ...this._settings,
      db: this._settings.database as number,
      tls: this._settings.ssl ? {} : undefined,
    });

    this._redisClientInstance = client;

    return this._redisClientInstance;
  }

  addMessages(messages: BaseMessage[]): Promise<void> {
    return this._history?.addMessages(messages);
  }

  addMessage(message: BaseMessage): Promise<void> {
    return this._history?.addMessage(message);
  }

  addUserMessage(message: string): Promise<void> {
    return this._history?.addUserMessage(message);
  }

  addAIMessage(message: string): Promise<void> {
    return this._history?.addAIMessage(message);
  }

  async getMessages(): Promise<BaseMessage[]> {
    const messages = (await this._history?.getMessages()).reverse();
    const cut = messages.slice(-(this._settings?.limit || 5));

    return cut;
  }

  getFormatedMessages(messages: BaseMessage[]): string {
    const formated = messages
      .map(
        (message) => `${message._getType().toUpperCase()}: ${message.content}`
      )
      .join('\n');

    return formated;
  }

  getChatHistory(): BaseListChatMessageHistory {
    return this._history;
  }

  clear(): Promise<void> {
    return this._history?.clear();
  }

  async build(): Promise<IChatHistory> {
    const client = await this.createClient();

    this._history = new RedisChatMessageHistory({
      sessionTTL: this._settings.sessionTTL,
      sessionId: this._settings.sessionId || new Date().toISOString(),
      client,
    });

    return this;
  }
}

export default RedisChatHistory;
