import { BaseChatModel } from 'langchain/chat_models/base';
import { IChatConfig, ILLMConfig } from '../../interface/agent.interface';
import { ChatOpenAI } from 'langchain/chat_models/openai';


class AzureLLMService {
  private _chatSettings: IChatConfig;
  private _llmSettings: ILLMConfig;

  constructor(chatSettings: IChatConfig, llmSettings: ILLMConfig) {
    this._chatSettings = chatSettings;
    this._llmSettings = llmSettings;
  }

  public build(): BaseChatModel {
    return new ChatOpenAI({
      temperature: this._chatSettings.temperature,
      streaming: true,
      azureOpenAIApiDeploymentName: this._llmSettings.model,
      azureOpenAIApiVersion: this._llmSettings.apiVersion,
      azureOpenAIApiKey: this._llmSettings.apiKey,
      azureOpenAIApiInstanceName: this._llmSettings.instance,
    });
  }
}

export default AzureLLMService;