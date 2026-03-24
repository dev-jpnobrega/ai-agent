import * as zod from 'zod';

import {
  IAgent,
  IAgentConfig,
  ICheckpointerConfig,
  IDatabaseConfig,
} from '../../interface/agent.interface';

import { BaseCheckpointSaver } from '@langchain/langgraph/dist';

import RetrievalTool from './retrieval-tool';
import { StructuredTool } from '@langchain/core/tools';
import VectorStoreFactory from '../vector-store';

interface ITool {
  name: string;
  description: string;
  schema: zod.ZodObject<any>;
  func: (input: any) => Promise<string>;
}

class ToolsFactory {
  public static async create(
    settings: IAgentConfig,
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

    return tools;
  }
}

export { ToolsFactory, ITool };
