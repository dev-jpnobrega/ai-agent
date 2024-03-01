import { Document } from 'langchain/document';
import { VectorStore } from 'langchain/vectorstores/base';
import { Client } from "@opensearch-project/opensearch";
import { OpenSearchVectorStore } from "langchain/vectorstores/opensearch";

interface OpenSearchClientArgs {
  clientUrl: string
  indexName: string[]
  service: "es" | "aoss"
}

export class AwsOpenSearch<TModel extends Record<string, unknown>> extends VectorStore {

  private _config: OpenSearchClientArgs;
  private _client: Client

  constructor(embeddings: any, dbConfig: OpenSearchClientArgs) {

    super(embeddings, dbConfig);

    console.log('[Embeddings]', embeddings)

    this._client = new Client({
      nodes: embeddings.clientUrl,
    });

    console.log('[this._client]', this._client)
    console.log('[dbConfig]', dbConfig)

    this._config = dbConfig;
  }

  _vectorstoreType(): string {
    return 'bedrock-cog-search';
  }

  async addDocuments(documents: Document<TModel>[]) {

    await OpenSearchVectorStore.fromDocuments(documents, this.embeddings, {
      client: this._client,
      indexName: this._config.indexName[0],
    })
  }

  async similaritySearch(
    query: string,
    k?: number,
  ): Promise<Document<TModel>[]> {

    const vectorStore = new OpenSearchVectorStore(this.embeddings, {
      client: this._client,
    });

    const results = await vectorStore.similaritySearch(query, k);

    return results as Document<TModel>[];
  }

  addVectors(vectors: number[][], documents: Document<Record<string, any>>[], options?: { [x: string]: any; }): Promise<void | string[]> {
    throw new Error('Method not implemented.');
  }
  similaritySearchVectorWithScore(query: number[], k: number, filter?: this['FilterType']): Promise<[Document<Record<string, any>>, number][]> {
    throw new Error('Method not implemented.');
  }
  
}
