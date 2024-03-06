import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Client } from '@opensearch-project/opensearch/.';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { Callbacks } from 'langchain/callbacks';
import { Document } from 'langchain/document';
import { Embeddings } from 'langchain/embeddings/base';
import { VectorStore } from 'langchain/vectorstores/base';
import { OpenSearchClientArgs } from 'langchain/vectorstores/opensearch';
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

type AwsCogVectorField = {
  value: number[];
  fields: string;
  k: number;
};

type AzureCogFilter = {
  search?: string;
  facets?: string[];
  filter?: string;
  top?: number;
  vectorFields: string;
};

type AwsCogRequestObject = {
  search: string;
  facets: string[];
  filter: string;
  vectors: AwsCogVectorField[];
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

export interface ICustomOpenSearchClientArgs extends OpenSearchClientArgs {
  vectorFieldName: string
}

export class AwsOpenSearch<TModel extends Record<string, unknown>> extends VectorStore {

  private _config: ICustomOpenSearchClientArgs;
  private _client: Client

  constructor(embeddings: any, dbConfig: ICustomOpenSearchClientArgs) {

    super(embeddings, dbConfig);

    this._config = dbConfig;
    console.log("1 🚀 ~ AwsOpenSearch<TModel ~ constructor ~ this._config:", this._config)
  }

  _vectorstoreType(): string {
    return 'aws-cog-search';
  }

  get config(): ICustomOpenSearchClientArgs {
    return this._config;
  }

  get baseUrl(): string {
    return `https://oibsdrs1b4kf1ypbap0d.us-east-1.aoss.amazonaws.com/bedrock-gdp-rag-index/_doc`;
    //return `https://search-ai-enterprise-tybnkbbhjomexdfx237kjxci3i.us-east-1.es.amazonaws.com/_dashboards`;
  }

  async addDocuments(documents: Document<TModel>[]): Promise<string[]> {
    console.log("2 🚀 ~ AwsOpenSearch<TModel ~ addDocuments ~ texts:")
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
    console.log("3 🚀 ~ AwsOpenSearch<TModel ~ results:")

    let results: any[] = []
    try {

      
      console.log("3.3 🚀 ~ AwsOpenSearch<TModel ~ queryEmbed:")

      results = await this.similaritySearchVectorWithScore(
        await this.embeddings.embedQuery(query),
        k || 4,
        filter,
        // filter.filter
      );
    } catch(e) {
      console.log("3.4 🚀 ~ AwsOpenSearch<TModel ~ e:", e)
    }

    return results.map(([doc, _score]) => doc);
  }

  async similaritySearchWithScore(
    query: string,
    k?: number,
    filter?: AzureCogFilter,
    _callbacks: Callbacks | undefined = undefined
  ): Promise<[Document<TModel>, number][]> {
    
    console.log("4 🚀 ~ AwsOpenSearch<TModel ~ embeddings:")
    const embeddings = await this.embeddings.embedQuery(query);
    
    return this.similaritySearchVectorWithScore(embeddings, k || 5, filter);
  }

  async addVectors(
    vectors: number[][],
    documents: Document<TModel>[]
  ): Promise<string[]> {
    console.log("5 🚀 ~ AwsOpenSearch<TModel ~ indexes:")
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
    const url = this.baseUrl;
    const responseObj = await fetcher(
      url,
      documentIndexRequest,
      "ASIAVEKDIBUE4NLRNFPL"
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
    console.log("6 🚀 ~ AwsOpenSearch<TModel ~ url:")
    const url = this.baseUrl

    const searchBody: AwsCogRequestObject = {
      search: filter?.search || '*',
      facets: filter?.facets || [],
      filter: filter?.filter || '',
      vectors: [{ value: query, fields: filter?.vectorFields || '', k: k }],
      top: filter?.top || k,
    };

    const resultDocuments = (await fetcher(
      url,
      searchBody,
      "ASIAVEKDIBUE4NLRNFPL"
    )) as DocumentSearchResponseModel<Document<TModel> & DocumentSearchModel>;

    return resultDocuments.value.map((doc) => [doc, doc['@search.score'] || 0]);
  }
}

const fetcher = async (url: string, body: any, apiKey: string) => {

  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");

  const question = "Olá, quem é vocÊ?";
  const prompt_template = `Human: Você é a MAIA, a inteligência artificial do GDP (Global Data Platform), você pode responder perguntas relacionadas indicadores de estrutura comercial da Natura. Use as seguintes partes do contexto para fornecer uma resposta concisa à pergunta no final. Responda de forma mais natural possivel. Se você não sabe a resposta, apenas diga que não sabe, não tente inventar uma resposta. Se o usuário te cumprimentar, apenas cumprimente de volta, não tente consultar o contexto. Se apresente e diga o que você pode fazer somente se o usuário perguntar.\n
  Question: ${question}\n
  Assistant:`;

  const novoBody = {
    ...body,
    prompt: prompt_template,
    max_tokens_to_sample: 300
  }

  const raw = JSON.stringify(novoBody);
  console.log("7 🚀 ~ fetcher ~ raw:", raw)

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    
  };

  fetch(url, requestOptions)
    .then((result) => console.log("🚀 ~ result", result))
    .catch((error) => console.error("🚀 ~ error", error));



  const response = await fetch(url, requestOptions)
  console.log("8 🚀 ~ fetcher ~ response:", response)

  if (!response.ok) {
    const err = await response.json();

    throw new Error(JSON.stringify(err));
  }

  return await response.json();
}
