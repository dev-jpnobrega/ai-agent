import { Document } from 'langchain/document';
import { VectorStore } from '@langchain/core/vectorstores';
import { nanoid } from 'nanoid';

import request from '../../../helpers/http-request.helpers';
import {
  AzureCogFilter,
  AzureCogRequestObject,
  AzureSearchConfig,
  DocumentSearchModel,
  DocumentSearchResponseModel,
} from './azure-vector-types';
import { Callbacks } from '@langchain/core/callbacks/manager';

export class AzureCogSearch<
  TModel extends Record<string, unknown>
> extends VectorStore {
  private _config: AzureSearchConfig;

  constructor(embeddings: any, dbConfig: AzureSearchConfig) {
    embeddings.azureOpenAIApiDeploymentName = dbConfig.model;

    super(embeddings, dbConfig);

    this._config = dbConfig;
  }

  _vectorstoreType(): string {
    return 'azure-cog-search';
  }

  get config(): AzureSearchConfig {
    return this._config;
  }

  get baseUrl(): string {
    return `https://${this._config.name}.search.windows.net/indexes`;
  }

  get apiVersion(): string {
    return this._config.apiVersion;
  }

  get apiKey(): string {
    return this._config.apiKey;
  }

  async addVectors(
    vectors: number[][],
    documents: Document<TModel>[]
  ): Promise<string[]> {
    const indexes: Array<any> = [];

    documents.forEach((document, i) => {
      indexes.push({
        id: nanoid().replace('_', ''),
        ...document,
        [this._config.vectorFieldName]: vectors[i],
      });
    });

    // run through indexes and if the id has _ then remove it
    indexes.forEach((index) => {
      if (index.id.includes('_')) {
        index.id = index.id.replace('_', '');
      }
    });

    const documentIndexRequest: DocumentSearchResponseModel<TModel> = {
      value: indexes,
    };

    // TODO: indexes
    const url = `${this.baseUrl}/${this._config.indexes[0]}/docs/index?api-version=${this.apiVersion}`;
    const responseObj = await fetcher(url, documentIndexRequest, this.apiKey);

    return responseObj.value.map((doc: any) => doc.key);
  }

  async addDocuments(documents: Document<TModel>[]): Promise<string[]> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async similaritySearch(
    query: string,
    k?: number,
    filter?: AzureCogFilter
  ): Promise<Document<TModel>[]> {
    const filterWithQuery = {
      ...filter,
      search: query,
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
    filter?: AzureCogFilter,
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
    filter?: AzureCogFilter,
    index?: string
  ): Promise<[Document<TModel>, number][]> {
    // TODO: indexes
    const url = `${this.baseUrl}/${
      index || this._config.indexes[0]
    }/docs/search?api-version=${this.apiVersion}`;

    const resultDocuments = (await fetcher(
      url,
      this.getSearchBody(filter, k || 10, query),
      this.apiKey
    )) as DocumentSearchResponseModel<Document<TModel> & DocumentSearchModel>;

    const formatDocs: [Document<TModel>, number][] = resultDocuments.value.map(
      (doc) => [
        doc as Document<TModel>,
        doc['@search.rerankerScore'] || doc['@search.score'] || 0,
      ]
    );

    return formatDocs;
  }

  private getSearchBody(
    filter: AzureCogFilter,
    k: number,
    query?: number[]
  ): AzureCogRequestObject {
    return {
      select: 'pageContent, metadata',
      search: filter?.search || '*',
      facets: filter?.facets || [],
      filter: filter?.filter || '',
      queryType: 'semantic',
      semanticConfiguration: 'config_page_content',
      captions: 'extractive',
      answers: 'extractive',
      vectorQueries: [
        {
          kind: 'vector',
          vector: query,
          fields: filter?.vectorFields || this._config.vectorFieldName || '',
          k,
        },
      ],
      top: k,
    };
  }
}

const fetcher = async (url: string, body: any, apiKey: string) => {
  const options = {
    url,
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
  };

  try {
    const rs = await request(options, false);

    return rs.body;
  } catch (error) {
    console.error('vector-error', error);
    throw error;
  }
};
