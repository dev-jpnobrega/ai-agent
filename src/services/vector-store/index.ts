import { VectorStore } from '@langchain/core/vectorstores';
import { OpenAIEmbeddings } from '@langchain/openai';

import { AzureCogSearch } from './azure/azure-vector-store';
import { AWSCogSearch } from './aws/opensearch-vector-store';
import {
  ILLMConfig,
  IVectorStoreConfig,
} from '../../interface/agent.interface';

const ServiceEmbeddings = {
  azure: OpenAIEmbeddings,
  aws: OpenAIEmbeddings,
} as any;

const ServiceVectores = {
  azure: AzureCogSearch,
  aws: AWSCogSearch,
} as any;

class VectorStoreFactory {
  public static create(
    settings: IVectorStoreConfig,
    llmSettings: ILLMConfig
  ): VectorStore {
    const embedding = new ServiceEmbeddings[settings.type]({
      ...llmSettings,
      azureOpenAIApiVersion: llmSettings.apiVersion,
      azureOpenAIApiKey: llmSettings.apiKey,
      azureOpenAIApiInstanceName: llmSettings.instance,
      azureOpenAIApiDeploymentName: settings.model,
      model: settings.model,
    });

    const service = new ServiceVectores[settings.type](
      embedding,
      settings
    ) as VectorStore;

    return service;
  }
}

export default VectorStoreFactory;
