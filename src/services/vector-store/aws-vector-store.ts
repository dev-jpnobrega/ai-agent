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

  constructor(embeddings: any, dbConfig: ICustomOpenSearchClientArgs) {

    super(embeddings, dbConfig);

    this._config = dbConfig;
    console.log("🚀 ~ AwsOpenSearch<TModel ~ constructor ~ this._config:", this._config)
  }

  _vectorstoreType(): string {
    return 'aws-cog-search';
  }

  get config(): ICustomOpenSearchClientArgs {
    return this._config;
  }

  get baseUrl(): string {
    return `https://oibsdrs1b4kf1ypbap0d.us-east-1.aoss.amazonaws.com/bedrock-gdp-rag-index/_doc`;
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
    const url = this.baseUrl;
    const responseObj = await fetcher(
      url,
      documentIndexRequest,
      "ASIAVEKDIBUE2DAVRM74"
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
      "ASIAVEKDIBUE2DAVRM74"
    )) as DocumentSearchResponseModel<Document<TModel> & DocumentSearchModel>;

    return resultDocuments.value.map((doc) => [doc, doc['@search.score'] || 0]);
  }
}

const fetcher = async (url: string, body: any, apiKey: string) => {

  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  myHeaders.append("X-Amz-Content-Sha256", "beaead3198f7da1e70d03ab969765e0821b24fc913697e929e726aeaebf0eba3");
  myHeaders.append("X-Amz-Security-Token", "IQoJb3JpZ2luX2VjEIX//////////wEaCXVzLWVhc3QtMSJHMEUCIB3sa2bP//l6QTAfGAPOXBpPIAN4o3lUHhuvhOfPWFq7AiEArwxKVJxn+Mcd/FFjGCSy9pXubUpLBjCuZJOTj1gB8KQqngMIfhADGgwzNTI4NjUyMjU5OTMiDDYq/kS43snI4y7N3Sr7AsRDPKfscg+TksFWbrEfCUjXdbBu4es1LFgjx+HdsckUJRv0UvzbinEXXg9g/NsrNLv0F8CSDsLUeJh4HWqxXForZeiVHOTkNEEvd67+6xJ+x9fdF4hwHQZRIP4kpeSav+SPIcvMW1kdiaApSth/tqF36Hssed85EfeM78sXECSzSdCa0pSi8mXd3yi2q4o+XeaTDa0prZapNKdTL4jnAPgGQgOFJBjp5m6rpqhmsiMMxYZMFZzk3vwPFFQe9R/2yot1bfdbpJwx6BubRYMHkoa335J1x43TMozWu8SX6P8l18z+GlpdDG7FQsofSvpVlzl6lYmXTW7xExKvOcTLf17PyXiX1cWUpxD3sIfBS4qazspgvpeobx+WWmVbneK4tR4JTwFBgs8prHo/5iuHJTCVF23S5pGZrVDRgbC/ZmNa9O3qw0Vr1LFOw0pEn06yUgsn0gtdyotfcrACGMBN05jtvoqUSdfjyS+tGXR7VbZK8jTB7x5cPh70Jvgw7N6YrwY6pgGPEv0R65z281rXeelouV+sl85NlH92eOubXeXh4fyeX3UhW9owGQKarK9RkvYQe46eXAP0axmjoniMvsymvks0Zq7pbrdmuOzTGsdOcNwxDAucamaahgE18DVLQz3lurDI4gX0AZCgIiGz8KI2HfFrIxeWDVWbhygme4vm2jHe0ihCy/R1Kz9yjJgtHSvCDIDxt2Cl7TD5EW/uoOrvYfk7HzW1EHi+");
  myHeaders.append("X-Amz-Date", "20240304T203244Z");
  myHeaders.append("Authorization", "AWS4-HMAC-SHA256 Credential=ASIAVEKDIBUE2DAVRM74/20240304/us-east-1/execute-api/aws4_request, SignedHeaders=content-length;content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token, Signature=a83930cff4c440b8f62b05543fe144f477869244b9dad572272eeee5440de121");
  
  console.log("🚀 ~ fetcher ~ myHeaders:", myHeaders)

  const raw = JSON.stringify(body);
  
  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
  };

  const response = await fetch(url, requestOptions)

  if (!response.ok) {
    const err = await response.json();

    throw new Error(JSON.stringify(err));
  }

  return await response.json();
};
