import { Document } from 'langchain/document';
import { VectorStore } from 'langchain/vectorstores/base';
import { Client } from "@opensearch-project/opensearch";
import { OpenSearchVectorStore } from "langchain/vectorstores/opensearch";
import AWS, { Bedrock } from 'aws-sdk';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { CredentialType } from 'langchain/dist/util/bedrock';

import { PromptTemplate } from 'langchain/prompts';
import { BedrockEmbeddings } from 'langchain/embeddings/bedrock';
import { ILLMConfig } from '../../interface/agent.interface';
import { ChatBedrock } from 'langchain/chat_models/bedrock';
import { RetrievalQAChain, loadQAStuffChain } from 'langchain/chains';
import { ChainValues } from 'langchain/schema';
import { RunnableSequence } from 'langchain/schema/runnable';

import dotenv from 'dotenv'
dotenv.config()

interface OpenSearchClientArgs {
  clientUrl: string
  indexes: string[]
  model: string
  service: "es" | "aoss"
  customizeSystemMessage?: string;
}

export class AwsOpenSearch<TModel extends Record<string, unknown>> extends VectorStore {

  private _config: OpenSearchClientArgs;
  private _client: Client
  private _llmSettings: ILLMConfig

  constructor(embeddings: any, dbConfig: OpenSearchClientArgs, llmSettings?: ILLMConfig) {

    console.log('[Embeddings]', embeddings)
    console.log('[dbConfig]', dbConfig)

    super(embeddings, dbConfig);

    this._llmSettings = llmSettings
    this._config = dbConfig;

    this._client = new Client({
      ...AwsSigv4Signer({
        region: this._llmSettings.region,
        service: this._config.service,
        getCredentials: () => {
          const credentialsProvider = defaultProvider();
          return credentialsProvider();
        },
      }),
      node: 'https://oibsdrs1b4kf1ypbap0d.us-east-1.aoss.amazonaws.com'
    });
  }

  _vectorstoreType(): string {
    return 'bedrock-cog-search';
  }

  async addDocuments(documents: Document<TModel>[]) {

    await OpenSearchVectorStore.fromDocuments(documents, this.embeddings, {
      client: this._client,
      indexName: this._config.indexes[0],
    })
  }

  async similaritySearch___(
    query: string,
    k: number,
  ): Promise<Document<TModel>[]> {

    const bedrockClient = new BedrockRuntimeClient({
      region: this._llmSettings.region,
    });

    const llm = new ChatBedrock({
      region: this._llmSettings.region,
      model: this._llmSettings.model,
      maxTokens: 300,
      temperature: 0,
    });
    console.log("1 🚀 ~ AwsOpenSearch<TModel ~ llm:", llm)

    const vectorStore = new OpenSearchVectorStore(this.embeddings, {
      client: this._client,
      indexName: this._config.indexes[0],
    });

    const retriever = vectorStore.asRetriever(20);

    const prompt_template = this._config.customizeSystemMessage.concat(
      `\n
      Context: ${retriever}\n
      Question: ${query}\n
      Assistant:`
    )

    const prompt = new PromptTemplate({
      template: prompt_template,
      inputVariables: ['retriever', 'query']
    });

    const input = {
      modelId: "anthropic.claude-v2",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: prompt_template,
        max_tokens_to_sample: 300,
        temperature: 0.5,
        top_k: 250,
        top_p: 1,
      }),
    };

    const command = new InvokeModelCommand(input);

    bedrockClient.send(command).then((response) => {

      const rawRes = response.body;
      const jsonString = new TextDecoder().decode(rawRes);
      const parsedResponse = JSON.parse(jsonString);
      console.log("🚀 ~ AwsOpenSearch<TModel ~ bedrockClient.send ~ parsedResponse:", parsedResponse.completion)

    }).catch((err) => {
      console.log("err2:");
      console.log(err);
    });


    //return parsedResponse
    const retorno: Document<Record<string, any>>[] = []

    return retorno as Document<TModel>[];
  }

  async similaritySearch(
    query: string,
    k?: number,
  ): Promise<Document<TModel>[]> {

    const embeddings = new BedrockEmbeddings({
      region: "us-east-1",
      model: "amazon.titan-embed-text-v1", // Default value
    });

    const vectorStore = new OpenSearchVectorStore(embeddings, {
      client: this._client,
      indexName: this._config.indexes[0],
    });

    const results = await vectorStore.similaritySearch(query, 10, {
      vectorFieldName: 'embedding'
    });

    console.log("🚀 ~ AwsOpenSearch<TModel ~ results:", results)

    const retorno: Document<Record<string, any>>[] = []

    return retorno as Document<TModel>[];
  }

  addVectors(vectors: number[][], documents: Document<Record<string, any>>[], options?: { [x: string]: any; }): Promise<void | string[]> {
    throw new Error('Method not implemented.');
  }

  similaritySearchVectorWithScore(query: number[], k: number, filter?: this['FilterType']): Promise<[Document<Record<string, any>>, number][]> {
    throw new Error('Method not implemented.');
  }

}
