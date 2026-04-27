import { BaseCheckpointSaver } from '@langchain/langgraph/dist';

import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { ICheckpointerConfig } from '../../interface/agent.interface';

class PostgresCheckpointer {
  private _settings: ICheckpointerConfig;
  private _checkpointer?: BaseCheckpointSaver;

  constructor(settings: ICheckpointerConfig) {
    this._settings = settings;
  }

  async initPostgresCheckpointer() {
    if (this._checkpointer) return this._checkpointer;

    const connString = `postgresql://${this._settings.username ? `${this._settings.username}:${this._settings.password}@` : ''}${this._settings.host}:${this._settings.port}/${this._settings.database}?sslmode=disable`;

    const cth = PostgresSaver.fromConnString(connString, {
      schema: this._settings?.schema || 'public',
    });

    await cth.setup();

    this._checkpointer = cth;

    return this._checkpointer;
  }

  async build(): Promise<BaseCheckpointSaver> {
    const checkpointer = await this.initPostgresCheckpointer();

    return checkpointer;
  }
}

export default PostgresCheckpointer;
