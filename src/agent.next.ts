import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { Document } from '@langchain/core/documents';
import {
  AIMessage,
  BaseMessage,
  createAgent,
  HumanMessage,
  ReactAgent,
  StructuredTool,
  tool,
} from 'langchain';
import { v4 as uuid } from 'uuid';
import * as z from 'zod';

import {
  IAgent,
  IAgentConfig,
  ICheckpointerConfig,
  IInputProps,
  IMCPServerConfig,
  TModel,
} from './interface/agent.interface';

import AgentBase from './agent.base';

import EVENTS_NAME from './helpers/events.name';
import LLMFactory from './services/llm';
import VectorStoreFactory from './services/vector-store';
import MCPChain from './services/chain/mcp-client-chain';
import { BaseCheckpointSaver } from '@langchain/langgraph/dist';
import { CheckpointerFactory } from './services/checkpointer';

/**
 * Represents an Agent that extends the AgentBaseCommand and implements the IAgent interface.
 * This class is responsible for handling the setup and execution of language model interactions,
 * managing chat history, and emitting events based on the interactions.
 */
class AgentNext extends AgentBase implements IAgent {
  /**
   * The language model used by the agent.
   */
  private _llm: BaseLanguageModel;

  /**
   * The service responsible for building chains of interactions.
   */
  private _agent: ReactAgent;

  /**
   * An array of tools that implement the StructuredTool.
   * These tools are used internally by the agent executor to perform specific actions or operations.
   *
   * @private
   */
  private _tools: StructuredTool[] = [];

  private _checkpointer: BaseCheckpointSaver;

  /**
   * Creates an instance of the Agent class.
   * @param settings - The configuration settings for the agent.
   */
  constructor(settings: IAgentConfig) {
    super(settings);
    this.setup(settings);
  }

  /**
   * Sets up the agent with the provided settings.
   * @param settings - The configuration settings for the agent.
   */
  private setup(settings: IAgentConfig): void {
    this.name = (settings?.name || 'AssistentAgent').replace(/\s+/g, '_');
    this._llm = LLMFactory.create(settings.chatConfig, settings.llmConfig);
  }

  /**
   * Constructs a system message template for agent responses, outlining guidelines and input data.
   * The template includes placeholders for user rules, user context, and the question.
   *
   * @returns {string} The formatted system message template with embedded instructions and input placeholders.
   */
  private buildSystemMessages(input: any): string {
    let builtMessage = '';
    builtMessage += `
      Given the following inputs, formulate a concise and relevant response:\n
      1. User Rules (from USER CONTEXT > USER RULES), if provided\n
      2. User Context (from USER CONTEXT > CONTEXT), if available\n
      3. Document Context (from Context found in documents), if provided\n
      4. API Output (from API Result), if available\n
      5. Database output (from database result), if available. If database output is filled, use it for final answer, do not manipulate.\n
      6. MCP tool result, if available.\n\n\n\n

      Response Guidelines:\n
      - Prioritize User Rules and User Context if they are filled in.\n
      - Do not generate or fabricate information:\n
        Only use the data explicitly provided in the User Rules, User Context, Document Context, API Output, and Database Output. If the necessary information is not available, inform the user that the data is missing or request more details. Do not speculate or make assumptions beyond the provided information.\n
      - Ignore irrelevant conversation logs that dont pertain directly to the user's query.\n
      - Only respond if a clear question is asked.\n
      - The question must be a single sentence.\n
      - Remove punctuation from the question.\n
      - Remove any non-essential words or irrelevant information from the question.\n\n

      Focus on Accuracy and Timeliness:\n
      - Check for inconsistencies: If there are contradictions between different sources (e.g., documents, database, or user context), prioritize the most reliable information or request clarification from the user.\n
      - Consider time relevance: Always take into account the temporal nature of information, prioritizing the most updated and contextually relevant data.\n\n
      
      Input Data:\n
      - User Rules: ${input?.user_prompt || 'N/A'}\n
      - User Context: ${input?.user_context || 'N/A'}\n
    `;

    return builtMessage;
  }

  private buildPromptTemplate(input: any): BaseMessage[] {
    return [
      new AIMessage('Hello! How can I help?'),
      new HumanMessage(input.question),
    ];
  }

  private async buildTools(
    mcpConfig: IMCPServerConfig,
  ): Promise<StructuredTool[]> {
    if (this._tools && this._tools.length > 0) return this._tools;

    if (mcpConfig) {
      const mcpTools = await new MCPChain(this._settings).getTools();
      this._tools.push(...(mcpTools as StructuredTool[]));
    }

    return this._tools;
  }

  private async buildCheckpointer(settings: ICheckpointerConfig) {
    if (this._checkpointer) return this._checkpointer;

    this._checkpointer = await CheckpointerFactory.create(settings);

    return this._checkpointer;
  }

  /**
   * Streams data from a given chain and emits events for each chunk of data received.
   *
   * @param chain - The runnable chain that processes the input and returns a stream of data.
   * @param input - The input data to be processed by the chain.
   * @returns A promise that resolves to the concatenated string of all chunks received from the stream.
   *
   * @emits EVENTS_NAME.onToken - Emitted for each chunk of data received from the stream.
   */
  private async stream(
    agent: ReactAgent,
    input: any,
    _runId: string,
  ): Promise<string> {
    const stream = await agent.stream(input, {
      streamMode: 'updates',
      configurable: { sessionId: input?.chatThreadID || uuid() },
    });

    let finalMessage: string[] = [];
    for await (const chunk of stream) {
      const [step, content] = Object.entries(chunk)[0];
      console.log(`step: ${step}`);
      console.log(`content: ${JSON.stringify(content, null, 2)}`);

      this.emit(EVENTS_NAME.onToken, JSON.stringify(content, null, 2));
    }

    return ''.concat(...finalMessage);
  }

  /**
   * Calls the agent with the provided input properties.
   * @param args - The input properties for the agent call.
   * @returns A promise that resolves when the call is complete.
   *
   * @emits EVENTS_NAME.onMessage - Emitted with the concatenated final message once the stream is complete.
   * @emits EVENTS_NAME.onToken - If stream enable, emitted for each chunk of data received from the stream.
   * @emits EVENTS_NAME.onEnd - Emitted when the streaming process is terminated.
   */
  async call(args: IInputProps): Promise<void> {
    const runId = uuid();

    try {
      const input: any = {
        ...args,
        question: args?.question,
        chat_thread_id: args?.chatThreadID,
        user_name: args?.userSessionId,
        user_context: args?.context,
        user_prompt: this._settings?.systemMessage,
      };

      const tools = await this.buildTools(this._settings?.mcpServerConfig);

      this._agent = createAgent({
        systemPrompt: this.buildSystemMessages(input),
        model: this._llm,
        tools,
        name: this.name,
        checkpointer: await this.buildCheckpointer(
          this._settings?.checkpointerConfig,
        ),
      });

      let result: any;

      // const messages: Messages[] = this.buildPromptTemplate(input);

      if (args?.stream) {
        result = await this.stream(this._agent, input, runId);
      } else {
        result = await (this._agent as any).invoke(
          {
            messages: this.buildPromptTemplate(input),
          },
          {
            runName: this.name,
            runId,
            context: input,
            configurable: { thread_id: args?.chatThreadID || uuid() },
          },
        );
      }

      this.emit(EVENTS_NAME.onMessage, this.outputText(result?.messages));
      this.emit(EVENTS_NAME.onEnd, 'terminated');
    } catch (error) {
      this._logger.error(error);
      this.emit(EVENTS_NAME.onError, error);
    } finally {
      return;
    }
  }

  private outputText(messages: BaseMessage[]): string {
    const last = messages?.at(-1);
    const text =
      typeof last?.content === 'string'
        ? last.content
        : JSON.stringify(last?.content ?? '');

    return text;
  }

  async tranning(documents: Document<TModel>[]) {
    const service = VectorStoreFactory.create(
      this._settings.vectorStoreConfig,
      this._settings.llmConfig,
    );

    await service.addDocuments(documents);
  }

  /**
   * Executes the agent with the provided arguments.
   * @param args - The arguments for the agent execution.
   * @returns A promise that resolves when the execution is complete.
   * @throws An error with the provided arguments.
   */
  execute(args: any): Promise<void> {
    throw new Error(args);
  }
}

export default AgentNext;
