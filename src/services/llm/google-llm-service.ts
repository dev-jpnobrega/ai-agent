import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { IChatConfig, ILLMConfig } from '../../interface/agent.interface';

class GoogleLLMService {
  private _chatSettings: IChatConfig;
  private _llmSettings: ILLMConfig;

  constructor(chatSettings: IChatConfig, llmSettings: ILLMConfig) {
    this._chatSettings = chatSettings;
    this._llmSettings = llmSettings;
  }

  public build(): ChatGoogleGenerativeAI {
    return new ChatGoogleGenerativeAI({
      temperature: this._chatSettings.temperature,
      modelName: this._llmSettings.model,
      apiKey: this._llmSettings.apiKey,
      maxOutputTokens: this._llmSettings.maxOutputTokens || 2048,
      streaming: true,
    });
  }
}

export default GoogleLLMService;
