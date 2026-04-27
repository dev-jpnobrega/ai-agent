import { ICheckpointerConfig } from '../../interface/agent.interface';

import { BaseCheckpointSaver } from '@langchain/langgraph/dist';

import RedisCheckpointer from './redis-checkpointer';
import MemoryCheckpointer from './memory-checkpointer';
import PostgresCheckpointer from './postgres-checkpointer';

const Services = {
  redis: RedisCheckpointer,
  memory: MemoryCheckpointer,
  postgres: PostgresCheckpointer,
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
