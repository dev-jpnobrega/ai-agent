import { AzureCogFilter, CustomVectorStore } from './../../interface/vector-store.interface';
import { Callbacks } from 'langchain/callbacks';
import { Document } from 'langchain/document';
import { Embeddings } from 'langchain/embeddings/base';
import { VectorStore } from 'langchain/vectorstores/base';
import { nanoid } from 'nanoid';

interface AzureSearchConfig {
  name: string;
  indexes: string[];
  apiKey: string;
  apiVersion: string;
  vectorFieldName: string;
  model?: string;
}

interface DocumentSearchResponseModel<TModel> {
  value: TModel[];
}

type DocumentSearchModel = {
  '@search.score': number;
};

export interface AzureCogDocument extends Record<string, unknown> { }

type AzureCogVectorField = {
  value: number[];
  fields: string;
  k: number;
};


type AzureCogRequestObject = {
  search: string;
  facets: string[];
  filter: string;
  vectors: AzureCogVectorField[];
  top: number;
};


export interface FaqDocumentIndex extends AzureCogDocument {
  id: string;
  user: string;
  chatThreadId: string;
  embedding: number[];
  pageContent: string;
  metadata: any;
}

export class AzureCogSearch<TModel extends Record<string, unknown>> extends CustomVectorStore {
  
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
  
  search(query: string, k: number, filter?: AzureCogFilter): any {

    return this.similaritySearch(query, k, filter);
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
    filter?: AzureCogFilter,
  ): Promise<Document<TModel>[]> {
    const results = await this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k || 4,
      filter,
      // filter.filter
    );

    return results.map(([doc, _score]) => doc);
  }

  async similaritySearchWithScore(
    query: string,
    k?: number,
    filter?: AzureCogFilter,
    _callbacks: Callbacks | undefined = undefined
  ): Promise<[Document<TModel>, number][]> {
    const embeddings = await this.embeddings.embedQuery(query);
    return this.similaritySearchVectorWithScore(embeddings, k || 5, filter);
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
    const url = `${this.baseUrl}/${this._config.indexes[0]}/docs/index?api-version=${this._config.apiVersion}`;
    const responseObj = await fetcher(
      url,
      documentIndexRequest,
      this._config.apiKey
    );
    return responseObj.value.map((doc: any) => doc.key);
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: AzureCogFilter,
    index?: string
  ): Promise<[Document<TModel>, number][]> {

    // TODO: indexes
    const url = `${this.baseUrl}/${index || this._config.indexes[0]}/docs/search?api-version=${this._config.apiVersion}`;

    const searchBody: AzureCogRequestObject = {
      search: filter?.search || '*',
      facets: filter?.facets || [],
      filter: filter?.filter || '',
      vectors: [{ value: query, fields: filter?.vectorFields || '', k: k }],
      top: filter?.top || k,
    };

    const resultDocuments = (await fetcher(
      url,
      searchBody,
      this._config.apiKey
    )) as DocumentSearchResponseModel<Document<TModel> & DocumentSearchModel>;

    return resultDocuments.value.map((doc) => [doc, doc['@search.score'] || 0]);
  }
}

const fetcher = async (url: string, body: any, apiKey: string) => {
  const options = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
  };

  const response = await fetch(url, options);

  if (!response.ok) {
    const err = await response.json();

    throw new Error(JSON.stringify(err));
  }

  return await response.json();
};
