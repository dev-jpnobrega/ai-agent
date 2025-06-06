import { Document } from 'langchain/document';

import { RequestFilter, AWSSearchConfig } from './aws-vector-types';
import { Callbacks } from '@langchain/core/callbacks/manager';
import { OpenSearchVectorStore } from '@langchain/community/vectorstores/opensearch';

import { defaultProvider } from '@aws-sdk/credential-provider-node'; // V3 SDK.
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import {
  Delete_Response,
  Search_Request,
  Search_RequestBody,
} from '@opensearch-project/opensearch/api';
import { Hit } from '@opensearch-project/opensearch/api/_types/_core.search';

import { generateId } from '../../../helpers/string.helpers';

export class AWSCogSearch<
  TModel extends Record<string, unknown>
> extends OpenSearchVectorStore {
  private _config: AWSSearchConfig;
  private _client: Client;
  private _vectorStore: OpenSearchVectorStore;

  constructor(embeddings: any, vectorStoreConfig: AWSSearchConfig) {
    embeddings.azureOpenAIApiDeploymentName = vectorStoreConfig.model;

    super(embeddings, {
      client: undefined,
      indexName: vectorStoreConfig.indexes[0],
    });

    this._config = vectorStoreConfig;
    this.createClient(this._config);
  }

  _vectorstoreType(): string {
    return 'aws-opensearch';
  }

  get config(): AWSSearchConfig {
    return this._config;
  }

  get baseUrl(): string {
    return `${this._config.name}/indexes`;
  }

  get apiVersion(): string {
    return this._config.apiVersion;
  }

  get apiKey(): string {
    return this._config.apiKey;
  }

  private createClient(vectorStoreConfig: AWSSearchConfig): Client {
    if (this._client && this._vectorStore) return this._client;

    if (vectorStoreConfig?.user && vectorStoreConfig?.pass) {
      this._client = new Client({
        compression: 'gzip',
        auth: {
          username: vectorStoreConfig?.user,
          password: vectorStoreConfig?.pass,
        },
        node: vectorStoreConfig.name,
      });
    } else {
      this._client = new Client({
        compression: 'gzip',
        ...AwsSigv4Signer({
          region: vectorStoreConfig.region || 'us-east-1',
          service: vectorStoreConfig?.serviceType || 'es',
          getCredentials: () => {
            const credentialsProvider = defaultProvider();
            return credentialsProvider();
          },
        }),
        node: vectorStoreConfig.name,
      });
    }

    this._vectorStore = new OpenSearchVectorStore(this.embeddings, {
      client: this._client,
      indexName: vectorStoreConfig.indexes[0],
    });

    return this._client;
  }

  private onDocument(doc: any) {
    return {
      index: {
        _index: this._config.indexes[0],
      },
    };
  }

  private onDrop(doc: any) {
    console.error(`doc`, doc);
  }

  private getSearchBody(
    filter: RequestFilter,
    k: number,
    query?: number[]
  ): Search_RequestBody {
    const fields = filter.fields || [
      'CD_VENDA_PRODUTO',
      'DC_VENDA_PRODUTO',
      'TAGS',
    ];

    if (filter?.vectorSearch) {
      return {
        query: {
          knn: {
            [this._config.vectorFieldName]: {
              vector: query,
              k,
            },
          },
        },
      } as Search_RequestBody;
    }

    return {
      _source: filter.source || false,
      fields,
      min_score: filter?.minScore || 0.5,
      size: k,
      query: {
        bool: {
          must: [
            {
              match_all: { query: filter?.query, fields },
            },
          ],
        },
      },
    } as Search_RequestBody;
  }

  private getRecordToString(record: Record<string, any>): string {
    let result: string = '';

    Object.keys(record).map(
      (elem) => (result += `${elem}: ${record[elem]} \n `)
    );

    return result;
  }

  private formatDocs(hits: Hit[]): [Document<TModel>, number][] {
    const formatDocs: [Document<TModel>, number][] = hits.map((hit) => {
      const pageContent: string = hit.fields
        ? this.getRecordToString(hit.fields)
        : this.getRecordToString(hit._source);

      const metadata = hit.fields ? { ...hit.fields } : { ...hit._source };

      const doc = {
        pageContent,
        metadata,
      };

      return [doc, hit._score] as [Document<TModel>, number];
    });

    return formatDocs;
  }

  async addDocuments(documents: Document<TModel>[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    this.addVectors(await this.embeddings.embedDocuments(texts), documents);
  }

  async addVectors(
    vectors: number[][],
    documents: Document<TModel>[]
  ): Promise<void> {
    const indexes: Array<any> = [];

    documents.forEach((document, i) => {
      indexes.push({
        id: generateId(),
        ...document,
        [this._config.vectorFieldName]: vectors[i],
      });
    });

    try {
      const resp1 = await this._client.helpers.bulk({
        datasource: indexes,
        onDocument: this.onDocument.bind(this),
        onDrop: this.onDrop.bind(this),
      });

      return;
    } catch (error) {
      console.error('error', error);
      throw error;
    }
  }

  async delete(_params?: Record<string, any>): Promise<void> {
    await this.deleteDocuments([..._params?.id]);
  }

  async deleteDocuments(ids: string[]): Promise<Delete_Response[]> {
    const results = await Promise.all(
      ids.map(async (id) => {
        return this._client.delete({
          index: this._config.indexes[0],
          id,
        });
      })
    );

    return results;
  }

  async similaritySearch(
    query: string,
    k?: number,
    filter?: RequestFilter
  ): Promise<Document<TModel>[]> {
    const filterWithQuery = {
      ...filter,
      query,
    };

    const results = await this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k,
      filterWithQuery
    );

    return results.map(([doc, _score]) => doc);
  }

  async similaritySearchWithScore(
    query: string,
    k?: number,
    filter?: RequestFilter,
    _callbacks: Callbacks | undefined = undefined
  ): Promise<[Document<TModel>, number][]> {
    const filterWithQuery = {
      ...filter,
      search: query,
    };

    const embeddings = await this.embeddings.embedQuery(query);

    return this.similaritySearchVectorWithScore(embeddings, k, filterWithQuery);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k?: number,
    filter?: RequestFilter,
    index?: string
  ): Promise<[Document<TModel>, number][]> {
    try {
      const resp = await this._client.search({
        index: index || this._config.indexes[0],
        body: this.getSearchBody(filter, k || 10, query),
      });

      const hits: Hit[] = resp?.body?.hits?.hits || [];

      return this.formatDocs(hits);
    } catch (error) {
      console.error('error', error);
      throw error;
    }
  }
}
