import { VectorStore } from '@langchain/core/vectorstores';
import { AzureOpenAIEmbeddings, OpenAIEmbeddings } from '@langchain/openai';

import { AzureCogSearch } from './azure/azure-vector-store';
import { AWSCogSearch } from './aws/opensearch-vector-store';
import {
  ILLMConfig,
  IVectorStoreConfig,
} from '../../interface/agent.interface';

const ServiceVectores = {
  azure: AzureCogSearch,
  aws: AWSCogSearch,
} as any;

class VectorStoreFactory {
  public static create(
    settings: IVectorStoreConfig,
    llmSettings: ILLMConfig
  ): VectorStore {
    const embedding = this.instantiateEmbeddings(settings, llmSettings);

    const service = new ServiceVectores[settings.type](
      embedding,
      settings
    ) as VectorStore;

    return service;
  }

  private static instantiateEmbeddings(settings: IVectorStoreConfig, llmSettings: ILLMConfig): OpenAIEmbeddings{
    if (settings.type === 'azure') {
      return new AzureOpenAIEmbeddings({
        azureOpenAIApiDeploymentName: settings.model,
        azureOpenAIApiVersion: llmSettings.apiVersion,
        azureOpenAIApiKey: llmSettings.apiKey,
        azureOpenAIApiInstanceName: llmSettings.instance,
        model: settings.model,
      });
    }
    if (settings.type === 'aws') {
      return new OpenAIEmbeddings({
        ...llmSettings,
        model: settings.model,
      });
    }
  }
}

export default VectorStoreFactory;
