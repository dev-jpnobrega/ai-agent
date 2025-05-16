import { VECTOR_SERVICE_TYPE } from '../../../interface/agent.interface';

export interface AWSSearchConfig {
  name: string;
  indexes: string[];
  apiKey: string;
  apiVersion: string;
  vectorFieldName: string;
  model?: string;
  region?: string;
  user: string;
  pass: string;
  serviceType?: VECTOR_SERVICE_TYPE;
}

export type RequestFilter = {
  source?: boolean;
  filter?: string;
  fields?: string[];
  vectorSearch?: boolean;
  query?: string;
  top?: number;
  minScore?: number;
};
