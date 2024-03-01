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
  public static async create(
    chatSettings: IChatConfig,
    llmSettings: ILLMConfig
  ): Promise<BaseChatModel> {
    
    const serviceModule = await import(`./${llmSettings.type}-llm-service`);
    const LLMServiceClass = serviceModule.default;
    return new LLMServiceClass(chatSettings, llmSettings).build();
  }
}

export default LLMFactory;
