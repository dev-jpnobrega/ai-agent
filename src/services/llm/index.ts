import { BaseChatModel } from 'langchain/chat_models/base';
import { IChatConfig, ILLMConfig } from '../../interface/agent.interface';

import AzureLLMService from './azure-llm-service';
import GoogleLLMService from './google-llm-service';
import BedrockLLMService from './bedrock-llm-service';

const ServiceLLM = {
  azure: AzureLLMService,
  google: GoogleLLMService,
  aws: BedrockLLMService,
} as any;

class LLMFactory {
  public static create(
    chatSettings: IChatConfig,
    llmSettings: ILLMConfig
  ): BaseChatModel {
    return new ServiceLLM[llmSettings.type](chatSettings, llmSettings).build();
  }
}

export default LLMFactory;
