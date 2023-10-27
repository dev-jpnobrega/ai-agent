
import { IDatabaseConfig } from '../../interface/agent.interface';
import { BaseChatMessageHistory } from 'langchain/schema';

import RedisChatHistory from './redis-chat-history';

const Services = {
  redis: RedisChatHistory,
} as any;

class ChatHistoryFactory {
  public static async create(settings: IDatabaseConfig): Promise<BaseChatMessageHistory> {
    return await new Services[settings.type](settings).build();
  }
}

export default ChatHistoryFactory;
