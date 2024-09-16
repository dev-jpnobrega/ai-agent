import { IDatabaseConfig } from '../../interface/agent.interface';
import { BaseChatMessageHistory, BaseMessage } from 'langchain/schema';

import RedisChatHistory from './redis-chat-history';
import { BufferMemory } from 'langchain/memory';
import MemoryChatHistory from './memory-chat-history';

interface IChatHistory {
  addUserMessage(message: string): Promise<void>;
  addAIChatMessage(message: string): Promise<void>;
  getMessages(): Promise<BaseMessage[]>;
  getFormatedMessages(messages: BaseMessage[]): string;
  clear(): Promise<void>;
  getChatHistory(): BaseChatMessageHistory;
  getBufferMemory(): BufferMemory;
}

const Services = {
  redis: RedisChatHistory,
  memory: MemoryChatHistory,
} as any;

class ChatHistoryFactory {
  public static async create(settings: IDatabaseConfig): Promise<IChatHistory> {
    const service = new Services[settings?.type](settings);

    if (!service) {
      return await new MemoryChatHistory(settings).build();
    }

    return await service.build();
  }
}

export { IChatHistory, ChatHistoryFactory };
