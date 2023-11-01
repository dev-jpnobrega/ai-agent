import { VectorStore } from 'langchain/vectorstores/base';
import { AzureCogSearch } from './azure-vector-store';
import { ILLMConfig, IVectorStoreConfig } from '../../interface/agent.interface';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';

const ServiceEmbeddings = { 
  azure: OpenAIEmbeddings,
} as any;

const ServiceVectores = {
  azure: AzureCogSearch,
} as any;

class VectorStoreFactory {
  public static create(settings: IVectorStoreConfig, llmSettings: ILLMConfig): VectorStore {
    const embedding = new ServiceEmbeddings[settings.type]({
      ...llmSettings,
      azureOpenAIApiVersion: llmSettings.apiVersion,
      azureOpenAIApiKey: llmSettings.apiKey,
      azureOpenAIApiInstanceName: llmSettings.instance,
      azureOpenAIApiDeploymentName: llmSettings.model,
    });
    
    const service = new ServiceVectores[settings.type](
      embedding,
      settings,
    );

    return service;
  }
}

export default VectorStoreFactory;
