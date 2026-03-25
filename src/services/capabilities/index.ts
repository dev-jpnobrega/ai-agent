import * as zod from 'zod';

import { IAgentConfig } from '../../interface/agent.interface';

import RetrievalTool from './retrieval-capabilities';
import OpenAPITool from './openapi-capabilities';
import { StructuredTool } from '@langchain/core/tools';
import VectorStoreFactory from '../vector-store';
import { BaseLanguageModel } from '@langchain/core/language_models/base';

interface ICapability {
  name: string;
  description: string;
  schema: zod.ZodObject<any>;
  func: (input: any) => Promise<string>;
  getTool: () => StructuredTool;
}

class CapabilitiesFactory {
  public static async create(
    settings: IAgentConfig,
    model: BaseLanguageModel,
  ): Promise<StructuredTool[]> {
    const tools: StructuredTool[] = [];

    if (settings?.vectorStoreConfig) {
      const vectorStore = await VectorStoreFactory.create(
        settings.vectorStoreConfig,
        settings.llmConfig,
      );

      const retrievalTool = new RetrievalTool(vectorStore).getTool();
      tools.push(retrievalTool);
    }

    if (settings?.openAPIConfig) {
      const openAPITool = new OpenAPITool(
        settings.openAPIConfig,
        model,
      ).getTool();

      tools.push(openAPITool);
    }

    return tools;
  }
}

export { CapabilitiesFactory, ICapability };
