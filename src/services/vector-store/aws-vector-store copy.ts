import { Document } from 'langchain/document';
import { VectorStore } from 'langchain/vectorstores/base';
import { Client } from "@opensearch-project/opensearch";
import { OpenSearchVectorStore } from "langchain/vectorstores/opensearch";

interface OpenSearchClientArgs {
  clientUrl: string
  indexes: string[]
  service: "es" | "aoss"
}

export class AwsOpenSearch<TModel extends Record<string, unknown>> extends VectorStore {

  private _config: OpenSearchClientArgs;
  private _client: Client

  constructor(embeddings: any, dbConfig: OpenSearchClientArgs) {

    console.log('[Embeddings]', embeddings)
    super(embeddings, dbConfig);


    this._client = new Client({
      nodes: ["https://oibsdrs1b4kf1ypbap0d.us-east-1.aoss.amazonaws.com"],
    });

    this._config = dbConfig;
  }

  _vectorstoreType(): string {
    return 'bedrock-cog-search';
  }

  async addDocuments(documents: Document<TModel>[]) {
    console.log("🚀 ~ AwsOpenSearch<TModel ~ addDocuments ~ this._config.indexName[0]:", this._config.indexes[0])

    await OpenSearchVectorStore.fromDocuments(documents, this.embeddings, {
      client: this._client,
      indexName: this._config.indexes[0],
    })
  }

  async similaritySearch(
    query: string,
    k?: number,
  ): Promise<Document<TModel>[]> {
    
    console.log("🚀 ~ AwsOpenSearch<TModel ~ similaritySearch ~ this._config.indexes[0]:", this._config.indexes[0])
    console.log("🚀 ~ AwsOpenSearch<TModel ~ this._client:", this._client)

    const vectorStore = new OpenSearchVectorStore(this.embeddings, {
      client: this._client,
      indexName: this._config.indexes[0],
    });

    console.log("🚀 ~ AwsOpenSearch<TModel ~ similaritySearch ~ vectorStore:", vectorStore)
    console.log("🚀 ~ AwsOpenSearch<TModel ~ similaritySearch ~ query:", query)
    console.log("🚀 ~ AwsOpenSearch<TModel ~ similaritySearch ~ k:", k)

    const results = await vectorStore.similaritySearch(query, k);
    console.log("🚀 ~ AwsOpenSearch<TModel ~ similaritySearcht  ~ results:", results)

    return results as Document<TModel>[];
  }

  addVectors(vectors: number[][], documents: Document<Record<string, any>>[], options?: { [x: string]: any; }): Promise<void | string[]> {
    throw new Error('Method not implemented.');
  }
  similaritySearchVectorWithScore(query: number[], k: number, filter?: this['FilterType']): Promise<[Document<Record<string, any>>, number][]> {
    throw new Error('Method not implemented.');
  }
  
}
