import { VectorStore } from 'langchain/vectorstores/base';
import { AzureCogSearch } from './azure-vector-store';
import { AwsOpenSearch } from './aws-vector-store';
import { ILLMConfig, IVectorStoreConfig, LLM_TYPE } from '../../interface/agent.interface';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { BedrockEmbeddings } from 'langchain/embeddings/bedrock';
import { CredentialType } from 'langchain/dist/util/bedrock';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { Client } from '@opensearch-project/opensearch/.';
import { ChatBedrock } from 'langchain/chat_models/bedrock';
import AWS from 'aws-sdk';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

import dotenv from 'dotenv'
import { CustomVectorStore } from '../../interface/vector-store.interface';

dotenv.config()

const ServiceEmbeddings = {
  azure: OpenAIEmbeddings,
  bedrock: BedrockEmbeddings,
} as any;

const ServiceVectores = {
  azure: AzureCogSearch,
  bedrock: AwsOpenSearch,
} as any;


const typeSpecificConfigs = (settings: IVectorStoreConfig, llmSettings: ILLMConfig) => {
  

  // TODO: alterar para switch
  let configs = {
    azure: {
      azureOpenAIApiVersion: llmSettings.apiVersion,
      azureOpenAIApiKey: llmSettings.apiKey,
      azureOpenAIApiInstanceName: llmSettings.instance,
      azureOpenAIApiDeploymentName: llmSettings.model,
    },
    bedrock: {
      model: settings.model,
      region: llmSettings.region,
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

  public static create(settings: IVectorStoreConfig, llmSettings: ILLMConfig): CustomVectorStore {
    
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
      llmSettings
    );

    return service;
  }
}

export default VectorStoreFactory;


