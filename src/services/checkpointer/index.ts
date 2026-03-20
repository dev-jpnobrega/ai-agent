import {
  ICheckpointerConfig,
  IDatabaseConfig,
} from '../../interface/agent.interface';
import { BaseListChatMessageHistory } from '@langchain/core/chat_history';
import { BaseMessage } from '@langchain/core/messages';

import { BaseCheckpointSaver } from '@langchain/langgraph/dist';

import RedisCheckpointer from './redis-checkpointer';
import MemoryCheckpointer from './memory-checkpointer';

const Services = {
  redis: RedisCheckpointer,
  memory: MemoryCheckpointer,
} as any;

class CheckpointerFactory {
  public static async create(
    settings: ICheckpointerConfig,
  ): Promise<BaseCheckpointSaver> {
    const Service = Services[settings?.type];

    if (!Service) {
      return await new MemoryCheckpointer(settings).build();
    }

    return await new Service(settings).build();
  }
}

export { CheckpointerFactory };
