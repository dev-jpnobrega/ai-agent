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
    process.env.GOOGLE_API_KEY = this._llmSettings.apiKey;

    return new ChatGoogleGenerativeAI({
      temperature: this._chatSettings.temperature,
      modelName: this._llmSettings.model,
      maxOutputTokens: this._chatSettings.maxTokens || 2048,
      streaming: true,
    });
  }
}

export default GoogleLLMService;
