import { APIChain, BaseChain } from 'langchain/chains';
import { IOpenAPIConfig } from '../../interface/agent.interface';

import { BaseChatModel } from 'langchain/chat_models/base';

class OpenAPIChain {
  private _settings: IOpenAPIConfig;

  constructor(settings: IOpenAPIConfig) {
    this._settings = settings;
  }

  private getHeaders(): any {
    if (!this._settings.xApiKey && !this._settings.authorization) 
      return undefined;

    const temp: any = {};

    if (!this._settings?.xApiKey)
      temp['x-api-key'] = this._settings.xApiKey;

    if (!this._settings?.authorization)
      temp['Authorization'] = this._settings.authorization;  

    return {
      ...temp,
    }
  }

  public async create(llm: BaseChatModel, ...args: any): Promise<BaseChain> {
    const chainOpenAPI = APIChain.fromLLMAndAPIDocs(
      llm,
      this._settings.data,
      {
        outputKey: 'openAPIResult',
        headers: this.getHeaders(),
      },
    );

    return chainOpenAPI;
  }
}

export default OpenAPIChain;