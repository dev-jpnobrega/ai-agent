import { IChatConfig, ILLMConfig } from '../../interface/agent.interface';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';

class BedrockLLMService {
  private _chatSettings: IChatConfig;
  private _llmSettings: ILLMConfig;

  constructor(chatSettings: IChatConfig, llmSettings: ILLMConfig) {
    this._chatSettings = chatSettings;
    this._llmSettings = llmSettings;
  }

  public build(): BedrockChat {
    return new BedrockChat({
      temperature: this._chatSettings.temperature,
      streaming: true,
      model: this._llmSettings.model,
      region: this._llmSettings.region,
      credentials: {
        accessKeyId: this._llmSettings.apiKey,
        secretAccessKey: this._llmSettings.secretAccessKey,
        sessionToken: this._llmSettings.sessionToken,
      },
    });
  }
}

export default BedrockLLMService;
