import { APIChain, BaseChain, createOpenAPIChain } from 'langchain/chains';
import { IOpenAPIConfig } from '../../interface/agent.interface';

import { BaseChatModel } from 'langchain/chat_models/base';
import { IChain } from './';
import { BasePromptTemplate, PromptTemplate } from 'langchain/prompts';

import OpenAPIBaseChain from './openapi-basechain';
import { JsonOutputFunctionsParser, OutputFunctionsParser } from 'langchain/output_parsers';

class OpenAPIChain implements IChain {
  private _settings: IOpenAPIConfig;
  private _prompt: BasePromptTemplate;

  constructor(settings: IOpenAPIConfig, prompt: BasePromptTemplate) {
    this._settings = settings;
    this._prompt = prompt;
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
    /*
    const chain = await createOpenAPIChain(this._settings.data, {
      llm,
      llmChainInputs: {
        outputKey: 'openAPIResult',
        prompt: this._prompt,
        llm: undefined,
      },
    })

    const chainOpenAPI = APIChain.fromLLMAndAPIDocs(
      llm,
      this._settings.data,
      {
        apiUrlPrompt: new PromptTemplate({
          inputVariables: ['question', 'api_docs'],
          template: `
          You will receive the API documentation below:\n{api_docs}\n
          Using this documentation, generate a Nodejs fetch request to be executed.\n
          You must create the API URL to get a response, while still getting the information needed to respond to the question\n\n
          Question:{question}\n
          API URL:
          `,
        }),
        outputKey: 'openAPIResult',
        headers: this.getHeaders(),
      },
    );
    */
    
    const chain =  new OpenAPIBaseChain(this._settings.data, {
      llm,
    });
    
    
    
  
    return chain;
  }
}

export default OpenAPIChain;