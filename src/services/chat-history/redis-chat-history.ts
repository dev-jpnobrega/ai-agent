import { BaseChatMessageHistory, BaseMessage } from 'langchain/schema';
import { IDatabaseConfig } from '../../interface/agent.interface';
import { IChatHistory } from '.';
import { BufferMemory } from 'langchain/memory';

class RedisChatHistory implements IChatHistory {
  private _settings: IDatabaseConfig;
  private _redisClientInstance: any;
  private _history: BaseChatMessageHistory;
  private _bufferMemory: BufferMemory;

  constructor(settings: IDatabaseConfig) {
    this._settings = settings;
  }

  private async createClient(): Promise<any> {
    if (this._redisClientInstance) {
      return this._redisClientInstance;
    };

    const { Redis } = (await import('ioredis'));

    const client = new Redis({
      ...this._settings,
      db: this._settings.database as number,
      tls: {}
    });

    this._redisClientInstance = client;

    return this._redisClientInstance;
  }

  addUserMessage(message: string): Promise<void> {
    return this._history?.addUserMessage(message);
  }

  addAIChatMessage(message: string): Promise<void> {
    return this._history?.addAIChatMessage(message);
  }

  getMessages(): Promise<BaseMessage[]> {
    return this._history?.getMessages();
  }

  getFormatedMessages(messages: BaseMessage[]): string {
    const cut = messages
      .slice(-(this._settings?.limit || 5));

    const formated = cut.map((message) => `${message._getType().toUpperCase()}: ${message.content}`).join('\n');

    return formated;
  }

  getChatHistory(): BaseChatMessageHistory {
    return this._history;
  }

  getBufferMemory(): BufferMemory {
    return this._bufferMemory;
  }

  clear(): Promise<void> {
    return this._history?.clear();
  }
 
  async build(): Promise<IChatHistory> {
    const { RedisChatMessageHistory } = (await import('langchain/stores/message/ioredis'));

    const client = await this.createClient();

    this._history = new RedisChatMessageHistory({
      sessionTTL: this._settings.sessionTTL,
      sessionId: this._settings.sessionId || new Date().toISOString(),
      client,
    });

    this._bufferMemory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'chat_history',
      chatHistory: this._history,
    });

    return this;
  }
}

export default RedisChatHistory;