import { VectorStore } from '@langchain/core/vectorstores';
import {
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';

import { IAgentConfig } from '../../interface/agent.interface';
import { IChain } from '.';

class MCPChain implements IChain {
  private _settings: IAgentConfig;
  private _outputKey = 'mcpToolsResult';
  private _client: MultiServerMCPClient;
  private _llm: BaseLanguageModel;
  private _runName: string;
  private _runId: string;

  constructor(settings: IAgentConfig) {
    this._settings = settings;
  }

  private getMCPPrompt(): string {
    return `
      You should always think about what to do, do not use any tool if it is not needed. \n\n
    `;
  }

  private buildPromptTemplate(systemMessages: string) {
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemMessages],
      ['placeholder', '{history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    return prompt;
  }

  private async executeMCPTools(input: any) {
    const prompt = this.buildPromptTemplate(this.getMCPPrompt());

    return new Promise(async (resolve, reject) => {
      try {
        const tools = await this._client.getTools();

        const agent = createToolCallingAgent({
          llm: this._llm,
          tools,
          prompt,
        });

        const agentExecutor = new AgentExecutor({
          agent,
          tools,
          verbose: this._settings?.debug || true,
        });

        const response = await agentExecutor.invoke(
          {
            input: input.input,
            history: input.history,
            ...input,
          },
          {
            runName: this._runName,
            runId: this._runId,
            configurable: { sessionId: input?.chat_thread_id },
          }
        );

        return resolve(response);
      } catch (error) {
        console.error('Error during agent execution:', error);

        if (error.name === 'ToolException') {
          console.error('Tool execution failed:', error.message);
        }
        return reject(error);
      }
    });
  }

  private async buildMCPChain(): Promise<RunnableSequence<any, any>> {
    const runnable = RunnableSequence.from([
      {
        chat_thread_id: (input: any) => input.chat_thread_id,
        user_prompt: (input) => input.user_prompt,
        user_context: (input: any) => input.user_context,
        history: (input: any) => input.history,
        input: (input: any) => input.question,
        format_chat_messages: (input) => input.format_chat_messages,
      },
      {
        chat_thread_id: (input: any) => input.chat_thread_id,
        user_prompt: (input) => input.user_prompt,
        user_context: (input: any) => input.user_context,
        history: (input: any) => input.history,
        input: (input: any) => input.question,
        format_chat_messages: (input) => input.format_chat_messages,
        response: this.executeMCPTools.bind(this),
      },
      {
        [this._outputKey]: (previousStepResult: any) => {
          return {
            resume: previousStepResult?.response?.answer,
            context: previousStepResult?.response?.context,
          };
        },
      },
    ]);

    return runnable;
  }

  private async createClient(): Promise<MultiServerMCPClient> {
    if (this._client) {
      return this._client;
    }

    this._client = new MultiServerMCPClient({
      throwOnLoadError: this._settings.mcpConfig?.throwOnLoadError || true,
      prefixToolNameWithServerName:
        this._settings.mcpConfig?.prefixToolNameWithServerName || true,
      additionalToolNamePrefix:
        this._settings.mcpConfig?.additionalToolNamePrefix || 'mcp',
      useStandardContentBlocks:
        this._settings.mcpConfig?.useStandardContentBlocks || true,
      mcpServers: this._settings.mcpConfig?.mcpServers.reduce((acc, server) => {
        acc[server.name] = {
          ...server,
        };

        return acc;
      }, {} as Record<string, any>),
    });

    return this._client;
  }

  public async create(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any>> {
    const [, , , runId, runName] = args;
    this._runName = runName;
    this._runId = runId;
    this._llm = llm;
    this._client = await this.createClient();

    const mcpChain = await this.buildMCPChain();

    return RunnableSequence.from([
      RunnablePassthrough.assign({
        mcpChain,
      }),
      RunnablePassthrough.assign({
        [this._outputKey]: (input: { mcpChain: any }) => {
          return input.mcpChain[this._outputKey];
        },
      }),
    ]);
  }
}

export default MCPChain;
