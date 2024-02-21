import { BaseChatModel } from 'langchain/chat_models/base';
import { IChatConfig, ILLMConfig } from '../../interface/agent.interface';
import { ChatBedrock } from 'langchain/chat_models/bedrock';

class BedrockLLMService {
  private _chatSettings: IChatConfig;
  private _llmSettings: ILLMConfig;

  constructor(chatSettings: IChatConfig, llmSettings: ILLMConfig) {
    this._chatSettings = chatSettings;
    this._llmSettings = llmSettings;
  }

  public build(): BaseChatModel {
    return new ChatBedrock({
      temperature: this._chatSettings.temperature,
      streaming: true,
      model: this._llmSettings.model,
      // TODO check where to get the config
      // region: "",
      // credentials: {
      //   accessKeyId: "",
      //   secretAccessKey: "",
      // },
    });
  }
}

export default BedrockLLMService;