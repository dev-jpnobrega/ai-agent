import { BaseChain } from 'langchain/chains';
import { IOpenAPIConfig } from '../../interface/agent.interface';

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { OpenApiBaseChain } from './openapi-base-chain';
import { IChain } from '.';

class OpenAPIChain implements IChain {
  private _settings: IOpenAPIConfig;

  constructor(settings: IOpenAPIConfig) {
    this._settings = settings;
  }

  private getHeaders(): Record<string, string> | undefined {
    if (!this._settings.xApiKey && !this._settings.authorization)
      return undefined;

    const temp: any = {};

    if (!this._settings?.xApiKey) temp['x-api-key'] = this._settings.xApiKey;

    if (!this._settings?.authorization)
      temp['Authorization'] = this._settings.authorization;

    return { ...temp };
  }

  public async create(llm: BaseChatModel, ...args: any): Promise<BaseChain> {
    return new OpenApiBaseChain({
      llm,
      spec: this._settings.data,
      customizeSystemMessage: this._settings.customizeSystemMessage || '',
      headers: this.getHeaders(),
    });
  }
}

export default OpenAPIChain;
