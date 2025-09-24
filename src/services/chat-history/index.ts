import { IDatabaseConfig } from '../../interface/agent.interface';
import { BaseListChatMessageHistory } from '@langchain/core/chat_history';
import { BaseMessage } from '@langchain/core/messages';

import RedisChatHistory from './redis-chat-history';
import MemoryChatHistory from './memory-chat-history';

interface IChatHistory {
  addMessages(messages: BaseMessage[]): Promise<void>;
  addMessage(message: BaseMessage): Promise<void>;
  addUserMessage(message: string): Promise<void>;
  addAIMessage(message: string): Promise<void>;
  getMessages(): Promise<BaseMessage[]>;
  getFormatedMessages(messages: BaseMessage[]): string;
  clear(): Promise<void>;
  getChatHistory(): BaseListChatMessageHistory;
}

const Services = {
  redis: RedisChatHistory,
  memory: MemoryChatHistory,
} as any;

class ChatHistoryFactory {
  public static async create(settings: IDatabaseConfig): Promise<IChatHistory> {
    const Service = Services[settings?.type];

    if (!Service) {
      return await new MemoryChatHistory(settings).build();
    }

    return await new Service(settings).build();
  }
}

export { IChatHistory, ChatHistoryFactory };
