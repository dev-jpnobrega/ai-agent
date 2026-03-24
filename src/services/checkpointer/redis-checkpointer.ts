import { createClient } from 'redis';
import { BaseCheckpointSaver } from '@langchain/langgraph/dist';

import { RedisSaver } from '@langchain/langgraph-checkpoint-redis';
import { ICheckpointerConfig } from '../../interface/agent.interface';

class RedisCheckpointer {
  private _settings: ICheckpointerConfig;
  private _checkpointer: BaseCheckpointSaver;
  private _redisClientInstance: ReturnType<typeof createClient>;

  constructor(settings: ICheckpointerConfig) {
    this._settings = settings;
  }

  async initRedisClient() {
    if (this._redisClientInstance) return this._redisClientInstance;

    this._redisClientInstance = createClient({
      url: `redis://${this._settings.host}:${this._settings.port}`,
      database: (this._settings?.database as unknown as number) || 0,
      socket: {
        tls: this._settings.ssl ? true : false,
        port: this._settings.port,
      },
    });

    await this._redisClientInstance.connect();

    return this._redisClientInstance;
  }

  async build(): Promise<BaseCheckpointSaver> {
    if (this._checkpointer) return this._checkpointer;

    const redisClient = await this.initRedisClient();

    this._checkpointer = new RedisSaver(redisClient, {
      defaultTTL: this._settings?.sessionTTL || 60 * 60 * 24,
    });

    return this._checkpointer;
  }
}

export default RedisCheckpointer;
