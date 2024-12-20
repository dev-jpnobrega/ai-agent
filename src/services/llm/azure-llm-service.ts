import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { IChatConfig, ILLMConfig } from '../../interface/agent.interface';
import { ChatOpenAI } from '@langchain/openai';
import { BaseLanguageModel } from '@langchain/core/language_models/base';

class AzureLLMService {
  private _chatSettings: IChatConfig;
  private _llmSettings: ILLMConfig;

  constructor(chatSettings: IChatConfig, llmSettings: ILLMConfig) {
    this._chatSettings = chatSettings;
    this._llmSettings = llmSettings;
  }

  public build(): BaseLanguageModel {
    return new ChatOpenAI({
      temperature: this._chatSettings.temperature,
      streaming: true,
      maxConcurrency: 10,
      azureOpenAIApiDeploymentName: this._llmSettings.model,
      azureOpenAIApiVersion: this._llmSettings.apiVersion,
      azureOpenAIApiKey: this._llmSettings.apiKey,
      azureOpenAIApiInstanceName: this._llmSettings.instance,
    });
  }
}

export default AzureLLMService;
