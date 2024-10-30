import { BaseListChatMessageHistory } from '@langchain/core/chat_history';
import { BaseMessage } from '@langchain/core/messages';
import { IDatabaseConfig } from '../../interface/agent.interface';
import { IChatHistory } from '.';
import { BufferMemory } from 'langchain/memory';

class MemoryChatHistory implements IChatHistory {
  private _settings: IDatabaseConfig;
  private _history: BaseListChatMessageHistory;
  private _bufferMemory: BufferMemory;

  constructor(settings: IDatabaseConfig) {
    this._settings = settings;
  }
  addAIMessage(message: string): Promise<void> {
    return this._history?.addAIMessage(message);
  }

  addUserMessage(message: string): Promise<void> {
    return this._history?.addUserMessage(message);
  }

  async getMessages(): Promise<BaseMessage[]> {
    const messages = await this._history?.getMessages();
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

  getBufferMemory(): BufferMemory {
    return this._bufferMemory;
  }

  clear(): Promise<void> {
    return this._history?.clear();
  }

  async build(): Promise<IChatHistory> {
    const { ChatMessageHistory } = await import(
      '@langchain/community/stores/message/in_memory'
    );

    this._history = new ChatMessageHistory();

    this._bufferMemory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'chat_history',
      chatHistory: this._history as BaseListChatMessageHistory,
    });

    return this;
  }
}

export default MemoryChatHistory;
