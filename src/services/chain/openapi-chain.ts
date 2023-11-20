import { APIChain, BaseChain } from 'langchain/chains';
import { IOpenAPIConfig } from '../../interface/agent.interface';

import { BaseChatModel } from 'langchain/chat_models/base';

class OpenAPIChain {
  private _settings: IOpenAPIConfig;

  constructor(settings: IOpenAPIConfig) {
    this._settings = settings;
    console.log("ENABLE OPENAPI CHAIN");
  }


  public async create(llm: BaseChatModel, ...args: any): Promise<BaseChain> {

    const llmOpenAPI = APIChain.fromLLMAndAPIDocs(llm, this._settings.data, { outputKey: 'openAPIResult' });

    console.log(llmOpenAPI);
    return llmOpenAPI;
  }
}

export default OpenAPIChain;