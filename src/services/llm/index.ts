import { IChatConfig, ILLMConfig } from '../../interface/agent.interface';
import { BaseChatModel } from 'langchain/chat_models/base';

import AzureLLMService from './azure-llm-service';

const ServiceLLM = {
  azure: AzureLLMService,
} as any;

class LLMFactory {
  public static create(chatSettings: IChatConfig, llmSettings: ILLMConfig): BaseChatModel {
    return new ServiceLLM[llmSettings.type](
      chatSettings,
      llmSettings,
    ).build();
  }
}

export default LLMFactory;
