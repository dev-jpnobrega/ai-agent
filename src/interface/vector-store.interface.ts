import { VectorStore } from "langchain/vectorstores/base";
import { Document } from 'langchain/document';
import { TModel } from "./agent.interface";


export type AzureCogFilter = {
  search?: string;
  facets?: string[];
  filter?: string;
  top?: number;
  vectorFields: string;
};

export abstract class CustomVectorStore extends VectorStore {

  search(
    query: string,
    k: number,
    filter?: AzureCogFilter,
    mode?: string
  ): any {

    return '';
  }

}