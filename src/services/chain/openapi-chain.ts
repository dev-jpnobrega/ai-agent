import { BaseChain, createOpenAPIChain } from 'langchain/chains';
import { IDataSourceConfig } from '../../interface/agent.interface';

import { BaseChatModel } from 'langchain/chat_models/base';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { PromptTemplate } from 'langchain/prompts';

const SYSTEM_MESSAGE_DEFAULT = `
  Answer the users question as best as possible.\n
  If the response the API is JSON, format it in a friendly sentence.\n
  {format_instructions}\n
  {question}
`;

class OpenAPIChain {
  private _settings: IDataSourceConfig;
  
  constructor(settings: IDataSourceConfig) {
    this._settings = settings;
  }

  private getSystemMessage(): string { 
    return SYSTEM_MESSAGE_DEFAULT.concat(this._settings.customizeSystemMessage || '');
  }

  public async create(llm: BaseChatModel, ...args: any): Promise<BaseChain> {
    const systemTemplate = this.getSystemMessage();

    const chainOpenAPI = await createOpenAPIChain(
      '',
      {
        llm: llm as ChatOpenAI,
        prompt: new PromptTemplate({
          template: systemTemplate,
          inputVariables: ['question'],
          // partialVariables: { format_instructions: template },
        }),
      }, 
    );

    return chainOpenAPI;
  }
}

export default OpenAPIChain;