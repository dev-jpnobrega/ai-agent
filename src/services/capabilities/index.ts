import * as zod from 'zod';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { StructuredTool } from '@langchain/core/tools';

import { IAgentConfig } from '../../interface/agent.interface';
import RetrievalCapability from './retrieval-capability';
import OpenAPICapability from './openapi-capability';
import VectorStoreFactory from '../vector-store';
import SQLCapability from './sql-capability';

interface ICapability {
  name: string;
  description: string;
  schema: zod.ZodObject<any>;
  func: (input: Record<string, any>) => Promise<string>;
  getTool: () => StructuredTool;
}

class CapabilitiesFactory {
  private static enabledCapabilities(
    settings: IAgentConfig,
    model: BaseLanguageModel,
  ): StructuredTool[] {
    const tools: StructuredTool[] = [];

    if (settings?.vectorStoreConfig) {
      const vectorStore = VectorStoreFactory.create(
        settings.vectorStoreConfig,
        settings.llmConfig,
      );

      const retrievalCapability = new RetrievalCapability(
        vectorStore,
      ).getTool();
      tools.push(retrievalCapability);
    }

    if (settings?.openAPIConfig) {
      const openAPICapability = new OpenAPICapability(
        settings.openAPIConfig,
        model,
      ).getTool();

      tools.push(openAPICapability);
    }

    if (settings?.dataSourceConfig) {
      const { dataSourceConfig } = settings;

      const sqlCapability = new SQLCapability(
        dataSourceConfig,
        model,
      ).getTool();
      tools.push(sqlCapability);
    }

    return tools;
  }

  public static async create(
    settings: IAgentConfig,
    model: BaseLanguageModel,
  ): Promise<StructuredTool[]> {
    return this.enabledCapabilities(settings, model);
  }
}

export { CapabilitiesFactory, ICapability };
