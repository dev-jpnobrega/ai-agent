export interface AzureSearchConfig {
  name: string;
  indexes: string[];
  apiKey: string;
  apiVersion: string;
  vectorFieldName: string;
  model?: string;
}

export interface DocumentSearchResponseModel<TModel> {
  value: TModel[];
}

export type DocumentSearchModel = {
  '@search.score': number;
  '@search.rerankerScore': number;
  [key: string]: any;
};

export type AzureCogVectorField = {
  vector: number[];
  kind: string;
  fields: string;
  k: number;
};

export type AzureCogFilter = {
  search?: string;
  facets?: string[];
  filter?: string;
  top?: number;
  vectorFields: string;
};

export type AzureCogRequestObject = {
  select: string;
  search: string;
  facets: string[];
  filter: string;
  queryType: string;
  semanticConfiguration: string;
  captions: string;
  answers: string;
  vectorQueries: AzureCogVectorField[];
  top: number;
};

export interface AzureCogDocument extends Record<string, unknown> {}

export interface FaqDocumentIndex extends AzureCogDocument {
  id: string;
  user: string;
  chatThreadId: string;
  embedding: number[];
  pageContent: string;
  metadata: any;
}
