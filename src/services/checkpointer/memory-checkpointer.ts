import { BaseCheckpointSaver, MemorySaver } from '@langchain/langgraph';
import { ICheckpointerConfig } from '../../interface/agent.interface';

class RedisCheckpointer {
  private _settings: ICheckpointerConfig;
  private _checkpointer: BaseCheckpointSaver;

  constructor(settings: ICheckpointerConfig) {
    this._settings = settings;
  }

  async build(): Promise<BaseCheckpointSaver> {
    if (this._checkpointer) return this._checkpointer;

    this._checkpointer = new MemorySaver();

    return this._checkpointer;
  }
}

export default RedisCheckpointer;
