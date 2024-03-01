import { VectorStore } from 'langchain/vectorstores/base';
import { AzureCogSearch } from './azure-vector-store';
import { AwsOpenSearch } from './aws-vector-store';
import { ILLMConfig, IVectorStoreConfig, LLM_TYPE } from '../../interface/agent.interface';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { BedrockEmbeddings } from 'langchain/embeddings/bedrock';

const ServiceEmbeddings = {
  azure: OpenAIEmbeddings,
  aws: BedrockEmbeddings,
} as any;

const ServiceVectores = {
  azure: AzureCogSearch,
  aws: AwsOpenSearch,
} as any;


const typeSpecificConfigs = (llmSettings: ILLMConfig, type: LLM_TYPE) => {
  
  // alterar para switch
  let configs = {
    azure: {
      azureOpenAIApiVersion: llmSettings.apiVersion,
      azureOpenAIApiKey: llmSettings.apiKey,
      azureOpenAIApiInstanceName: llmSettings.instance,
      azureOpenAIApiDeploymentName: llmSettings.model,
    },
    aws: {
      model: llmSettings.model,
      region: llmSettings.region,
      credentials: {
        accessKeyId: llmSettings.apiKey,
        secretAccessKey: llmSettings.secretAccessKey,
        sessionToken: llmSettings.sessionToken
      },
    },
    gpt: {
    },
    google: {
      modelName: llmSettings.model,
      apiKey: llmSettings.apiKey,
    },
  }

  return configs[type] as any;
};

class VectorStoreFactory {

  public static create(settings: IVectorStoreConfig, llmSettings: ILLMConfig): VectorStore {

    const typeConfig = typeSpecificConfigs(llmSettings, settings.type)

    const embedding = new ServiceEmbeddings[settings.type]({
      ...llmSettings,
      ...typeConfig,
    });

    const service = new ServiceVectores[settings.type](
      embedding,
      settings,
    );

    return service;
  }
}

export default VectorStoreFactory;


