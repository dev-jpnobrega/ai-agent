import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { v4 as uuid } from 'uuid';

import AgentBase from './agent.base';

import {
  IAgent,
  IAgentExecutor,
  IInputProps,
  IMCPServerConfig,
} from './interface/agent.interface';

import EVENTS_NAME from './helpers/events.name';
import { IChainService, ChainService } from './services/chain';
import MCPChain from './services/chain/mcp-client-chain';
import LLMFactory from './services/llm';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import {
  AgentExecutor as AgentExecutorLangchain,
  createToolCallingAgent,
} from 'langchain/agents';
import { StructuredToolInterface } from '@langchain/core/tools';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { BaseListChatMessageHistory } from '@langchain/core/chat_history';

/**
 * Represents an Agent that extends the AgentBaseCommand and implements the IAgent interface.
 * This class is responsible for handling the setup and execution of language model interactions,
 * managing chat history, and emitting events based on the interactions.
 */
class AgentExecutor extends AgentBase implements IAgent {
  /**
   * The language model used by the agent.
   */
  private _llm: BaseLanguageModel;

  /**
   * The service responsible for building chains of interactions.
   */
  private _chainService: IChainService;

  /**
   * Holds the instance of the agent executor responsible for managing agent settings.
   *
   * @private
   * @type {IAgentExecutor}
   */
  private _settingsAgent: IAgentExecutor;

  /**
   * Instance of the AgentExecutorLangchain responsible for executing agent tasks.
   * Used internally to manage and run agent operations within the executor.
   */
  private _agentExecutor: AgentExecutorLangchain;

  /**
   * An array of tools that implement the StructuredToolInterface.
   * These tools are used internally by the agent executor to perform specific actions or operations.
   *
   * @private
   */
  private _tools: StructuredToolInterface[];

  /**
   * Creates an instance of the Agent class.
   * @param settings - The configuration settings for the agent.
   */
  constructor(settings: IAgentExecutor) {
    super(settings);

    this._settingsAgent = settings;
    this.setup(settings);
  }

  /**
   * Sets up the agent with the provided settings.
   * @param settings - The configuration settings for the agent.
   */
  private setup(settings: IAgentExecutor): void {
    this._name = settings?.name || 'AssistentAgentExecutor';
    this._llm = LLMFactory.create(settings.chatConfig, settings.llmConfig);
  }

  /**
   * Constructs a system message template for agent responses, outlining guidelines and input data.
   * The template includes placeholders for user rules, user context, and the question.
   *
   * @returns {string} The formatted system message template with embedded instructions and input placeholders.
   */
  private buildSystemMessages(): string {
    let builtMessage = '';
    builtMessage += `
      Given the following inputs, formulate a concise and relevant response:\n
      1. User Rules (from Input Data > USER RULES), if provided\n
      2. User Context (from Input Data > USER CONTEXT), if available\n\n\n

      Response Guidelines:\n
      - Prioritize User Rules and User Context if they are filled in.\n
      - Do not generate or fabricate information:\n
        Only use the data explicitly provided in the User Rules and User Context. If the necessary information is not available, inform the user that the data is missing or request more details. Do not speculate or make assumptions beyond the provided information.\n
      - Ignore irrelevant conversation logs that dont pertain directly to the user's query.\n
      - Only respond if a clear question is asked.\n
      - The question must be a single sentence.\n
      - Remove punctuation from the question.\n
      - Remove any non-essential words or irrelevant information from the question.\n\n

      Focus on Accuracy and Timeliness:\n
      - Consider time relevance: Always take into account the temporal nature of information, prioritizing the most updated and contextually relevant data.\n\n
      
      Input Data:\n
      - USER RULES: {user_prompt}\n
      - USER CONTEXT: {user_context}\n
    `;

    builtMessage += `
      Question:\n
      - {question}\n
    `;

    return builtMessage;
  }

  /**
   * Builds a chat prompt template for agent execution.
   *
   * The template consists of:
   * - A system message (provided as a parameter)
   * - A placeholder for conversation history
   * - A placeholder for the agent's scratchpad (intermediate steps)
   * - A human message containing the user's question
   *
   * @param systemMessages - The system message(s) to include in the prompt template.
   * @returns A `ChatPromptTemplate` composed of the specified messages and placeholders.
   */
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

  /**
   * Builds and returns a list of structured tools by combining the provided client tools
   * with additional tools retrieved from the MCPChain, if an MCP server configuration is supplied.
   *
   * @param clientTools - An array of tools provided by the client.
   * @param mcpConfig - The MCP server configuration. If present, additional tools are fetched and included.
   * @returns A promise that resolves to an array of structured tools, including both client and MCP tools if applicable.
   */
  private async buildTools(
    clientTools: StructuredToolInterface[],
    mcpConfig: IMCPServerConfig
  ): Promise<StructuredToolInterface[]> {
    if (this._tools && this._tools.length > 0) return this._tools;

    this._tools = clientTools || [];

    if (mcpConfig) {
      const mcpTools = await new MCPChain(this._settingsAgent).getTools();
      this._tools.push(...mcpTools);
    }

    return this._tools;
  }

  /**
   * Builds and returns an instance of `AgentExecutorLangchain`, initializing it if it hasn't been created yet.
   *
   * This method constructs the necessary tools and prompt template, creates a tool-calling agent,
   * and configures the agent executor with error handling and verbosity settings.
   *
   * @returns {Promise<AgentExecutorLangchain>} A promise that resolves to the initialized agent executor.
   */
  private async buildAgentExecutor(): Promise<AgentExecutorLangchain> {
    if (this._agentExecutor) return this._agentExecutor;

    const tools = await this.buildTools(
      this._settingsAgent.tools,
      this._settingsAgent.mcpServerConfig
    );

    const prompt = this.buildPromptTemplate(this.buildSystemMessages());

    const agent = createToolCallingAgent({ llm: this._llm, tools, prompt });

    this._agentExecutor = new AgentExecutorLangchain({
      agent,
      tools,
      verbose: this._settingsAgent?.debug ?? true,
      handleToolRuntimeErrors: (error: Error) => {
        this._settingsAgent.handleToolRuntimeErrors(error);
        this._logger.error(error);
        return error.message;
      },
    });

    return this._agentExecutor;
  }

  /**
   * Builds a chain by creating an agent executor and integrating it with the provided chat history.
   *
   * @param chatHistory - The chat message history to be used in the chain.
   * @returns A promise that resolves to the constructed chain.
   */
  private async buildChain(chatHistory: BaseListChatMessageHistory) {
    const agentExecutor = await this.buildAgentExecutor();

    if (!this._chainService) {
      this._chainService = new ChainService(this._settingsAgent);
    }

    const chain = await this._chainService.buildRunnableWithMessageHistory(
      agentExecutor,
      chatHistory as unknown as BaseListChatMessageHistory
    );

    return chain;
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
    chain: RunnableWithMessageHistory<any, any>,
    input: any,
    runId: string
  ): Promise<string> {
    const stream = await chain.stream(input, {
      runId,
      runName: this._name,
      configurable: { sessionId: input?.chatThreadID || uuid() },
    });

    let finalMessage: string[] = [];
    for await (const chunk of stream) {
      finalMessage.push(chunk);

      this.emit(EVENTS_NAME.onToken, chunk);
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
      const chatHistory = await this.buildHistory(
        args?.chatThreadID,
        this._settingsAgent.dbHistoryConfig
      );

      const chain = await this.buildChain(
        chatHistory as unknown as BaseListChatMessageHistory
      );

      const chatMessages = await chatHistory.getMessages();

      const input: any = {
        question: args?.question,
        chat_thread_id: args?.chatThreadID,
        user_name: args?.userSessionId,
        user_context: args?.context,
        user_prompt: this._settingsAgent?.systemMesssage,
        history: chatMessages,
        format_chat_messages: await chatHistory.getFormatedMessages(
          chatMessages
        ),
      };

      let result: any = '';

      if (args?.stream) {
        result = await this.stream(chain, input, runId);
      } else {
        result = await chain.invoke(input, {
          runName: this._name,
          runId,
          configurable: { sessionId: args?.chatThreadID || uuid() },
        });
      }

      this.emit(EVENTS_NAME.onMessage, result?.output ?? result);
      this.emit(EVENTS_NAME.onEnd, 'terminated');
    } catch (error) {
      this._logger.error(error);
      this.emit(EVENTS_NAME.onError, error);
    } finally {
      return;
    }
  }

  getTools(): StructuredToolInterface[] {
    return this._tools;
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

export default AgentExecutor;
