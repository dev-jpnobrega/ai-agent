
import { IDatabaseConfig } from '../../interface/agent.interface';
import { BaseChatMessageHistory, BaseMessage } from 'langchain/schema';

import RedisChatHistory from './redis-chat-history';
import { BufferMemory } from 'langchain/memory';
import MemoryChatHistory from './memory-chat-history';

interface IChatHistory  { 
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
    const service = Services[settings?.type]

    if (service) { 
      return new service(settings).build();
      
    }else{
      return await new MemoryChatHistory(settings).build();
    }

    
  }
}

export {
  IChatHistory,
  ChatHistoryFactory,
};
