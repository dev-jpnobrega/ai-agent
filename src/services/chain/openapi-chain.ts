import { BaseChain } from 'langchain/chains';
import { IOpenAPIConfig } from '../../interface/agent.interface';

import { BaseChatModel } from 'langchain/chat_models/base';
import { OpenApiBaseChain } from './openapi-base-chain';

class OpenAPIChain {
  private _settings: IOpenAPIConfig;

  constructor(settings: IOpenAPIConfig) {
    this._settings = settings;
    console.log(this._settings);
  }

  private getHeaders(): Record<string, string> | undefined {
    if (!this._settings.xApiKey && !this._settings.authorization)
      return undefined;

    const temp: any = {};

    if (!this._settings?.xApiKey)
      temp['x-api-key'] = this._settings.xApiKey;

    if (!this._settings?.authorization)
      temp['Authorization'] = this._settings.authorization;

    return { ...temp };
  }

  public async create(llm: BaseChatModel, ...args: any): Promise<BaseChain> {
    return new OpenApiBaseChain({
      llm,
      spec: this._settings.data,
      customMessage: this._settings.customizeSystemMessage || '',
      headers: this.getHeaders(),
    });
  }
}

export default OpenAPIChain;