import { VectorStore } from 'langchain/vectorstores/base';
import { AzureCogSearch } from './azure-vector-store';
import { AwsOpenSearch } from './aws-vector-store';
import { ILLMConfig, IVectorStoreConfig, LLM_TYPE } from '../../interface/agent.interface';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { BedrockEmbeddings } from 'langchain/embeddings/bedrock';
import { CredentialType } from 'langchain/dist/util/bedrock';

const ServiceEmbeddings = {
  azure: OpenAIEmbeddings,
  bedrock: BedrockEmbeddings,
} as any;

const ServiceVectores = {
  azure: AzureCogSearch,
  bedrock: AwsOpenSearch,
} as any;


const typeSpecificConfigs = (settings: IVectorStoreConfig, llmSettings: ILLMConfig) => {
  
  const credentials: CredentialType = {
    accessKeyId: llmSettings.apiKey,
    secretAccessKey: llmSettings.secretAccessKey,
    sessionToken: llmSettings.sessionToken,
  }

 /*  const client: BedrockRuntimeClient = new BedrockRuntimeClient({
    
  }) */

  // alterar para switch
  let configs = {
    azure: {
      azureOpenAIApiVersion: llmSettings.apiVersion,
      azureOpenAIApiKey: llmSettings.apiKey,
      azureOpenAIApiInstanceName: llmSettings.instance,
      azureOpenAIApiDeploymentName: llmSettings.model,
    },
    bedrock: {
      model: settings.model,
      client: '',
      region: llmSettings.region,
      credentials: credentials
    },
    gpt: {
    },
    google: {
      modelName: llmSettings.model,
      apiKey: llmSettings.apiKey,
    },
  }

  return configs[settings.type] as any;
};

class VectorStoreFactory {

  public static create(settings: IVectorStoreConfig, llmSettings: ILLMConfig): VectorStore {
    
    const typeConfig = typeSpecificConfigs(settings, llmSettings)

    console.log('[typeConfig]', typeConfig)
    
    const embedding = new ServiceEmbeddings[settings.type]({
      ...llmSettings,
      ...typeConfig,
    });
    console.log('[embedding - VectorStoreFactory]', embedding)

    const service = new ServiceVectores[settings.type](
      embedding,
      settings,
    );

    return service;
  }
}

export default VectorStoreFactory;


