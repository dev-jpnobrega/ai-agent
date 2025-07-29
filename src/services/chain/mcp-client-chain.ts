import { BaseLanguageModel } from '@langchain/core/language_models/base';
import {
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables';
import { StructuredToolInterface } from '@langchain/core/tools';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';

import { IChain } from '.';
import { IAgentConfig } from '../../interface/agent.interface';

class McpChain implements IChain {
  private _settings: IAgentConfig;
  private _llm: BaseLanguageModel;
  private _outputKey = 'mcpToolsResult';

  constructor(settings: IAgentConfig) {
    this._settings = settings;
  }

  private getMcpPrompt(): string {
    return `
      # You are a helpful AI Assistant focused on orchestrate tools according to user question (QUESTION) and following instructions from USER PROMPT\n
      ## You MUST adjust the tool input request according to its schema.
      Assistant is constantly learning and improving, and its capabilities are constantly evolving.
      It is able to process and understand large amounts of text, and can use this knowledge to provide accurate and informative responses.\n\n

      ## Input data:\n
      - USER PROMPT: {user_prompt_mcp}\n
      - USER CONTEXT: {user_context}\n
      - CHAT HISTORY: {format_chat_messages}\n
      - QUESTION: {question}\n\n
      `;
  }

  private buildPromptTemplate(systemMessages: string): ChatPromptTemplate {
    const combine_messages = [
      SystemMessagePromptTemplate.fromTemplate(systemMessages),
      new MessagesPlaceholder('history'),
      new MessagesPlaceholder('agent_scratchpad'),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ];
    const CHAT_COMBINE_PROMPT =
      ChatPromptTemplate.fromMessages(combine_messages);

    return CHAT_COMBINE_PROMPT;
  }

  private async getServersTools(): Promise<StructuredToolInterface[]> {
    let tools;
    const { mcpServerConfig } = this._settings;

    const client = new MultiServerMCPClient({
      throwOnLoadError: mcpServerConfig.throwOnLoadError || true,
      prefixToolNameWithServerName:
        mcpServerConfig.prefixToolNameWithServerName || true,
      useStandardContentBlocks:
        mcpServerConfig.useStandardContentBlocks || true,
      additionalToolNamePrefix:
        mcpServerConfig.additionalToolNamePrefix || 'mcp',
      mcpServers: mcpServerConfig.mcpServers,
    });

    try {
      tools = await client.getTools();
    } catch (error) {
      console.error(`Failed to retrieve tools`, error);
      throw error;
    }

    return tools;
  }

  private async buildMcpChain(): Promise<AgentExecutor> {
    const prompt = this.buildPromptTemplate(this.getMcpPrompt());

    const tools = await this.getServersTools();

    const agent = createToolCallingAgent({ llm: this._llm, tools, prompt });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: this._settings?.debug ?? true,
      handleToolRuntimeErrors: (error) => {
        return error.message;
      },
    });

    return agentExecutor;
  }
  public async create(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any>> {
    this._llm = llm;

    const mcpChain = await this.buildMcpChain();

    return RunnableSequence.from([
      RunnablePassthrough.assign({
        user_prompt_mcp: (input: any) =>
          this._settings?.mcpServerConfig.customizeSystemMessage,
      }),
      mcpChain,
      RunnablePassthrough.assign({
        [this._outputKey]: (previousStepResult: any) => {
          return previousStepResult?.output;
        },
      }),
    ]);
  }
}
export default McpChain;
