import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { nanoid } from 'ai';

import AgentBaseCommand from './agent.base';

import {
  IAgent,
  IAgentConfig,
  IDatabaseConfig,
  IInputProps,
} from './interface/agent.interface';

import EVENTS_NAME from './helpers/events.name';
import { ChainService, IChainService } from './services/chain';
import { ChatHistoryFactory, IChatHistory } from './services/chat-history';
import LLMFactory from './services/llm';

/**
 * Represents an Agent that extends the AgentBaseCommand and implements the IAgent interface.
 * This class is responsible for handling the setup and execution of language model interactions,
 * managing chat history, and emitting events based on the interactions.
 */
class Agent extends AgentBaseCommand implements IAgent {
  /**
   * The name of the agent.
   */
  private _name: string;

  /**
   * The language model used by the agent.
   */
  private _llm: BaseLanguageModel;

  /**
   * The service responsible for building chains of interactions.
   */
  private _chainService: IChainService;

  /**
   * The chat history associated with the agent.
   */
  private _chatHistory: IChatHistory;

  /**
   * The logger used for logging messages.
   */
  private _logger: Console;

  /**
   * The configuration settings for the agent.
   */
  private _settings: IAgentConfig;

  /**
   * Creates an instance of the Agent class.
   * @param settings - The configuration settings for the agent.
   */
  constructor(settings: IAgentConfig) {
    super();
    this._logger = console;
    this._settings = settings;
    this.setup(settings);
  }

  /**
   * Sets up the agent with the provided settings.
   * @param settings - The configuration settings for the agent.
   */
  private setup(settings: IAgentConfig): void {
    this._name = settings?.name || 'AssistentAgent';
    this._llm = LLMFactory.create(settings.chatConfig, settings.llmConfig);
    this._chainService = new ChainService(settings);
  }

  /**
   * Builds the chat history for the given user session.
   * @param userSessionId - The ID of the user session.
   * @param settings - The database configuration settings.
   * @returns A promise that resolves to the chat history.
   */
  private async buildHistory(
    userSessionId: string,
    settings: IDatabaseConfig
  ): Promise<IChatHistory> {
    if (this._chatHistory) return this._chatHistory;

    this._chatHistory = await ChatHistoryFactory.create({
      ...settings,
      sessionId: userSessionId,
    });

    return this._chatHistory;
  }

  /**
   * Calls the agent with the provided input properties.
   * @param args - The input properties for the agent call.
   * @returns A promise that resolves when the call is complete.
   */
  async call(args: IInputProps): Promise<void> {
    try {
      const chatHistory = await this.buildHistory(
        args?.chatThreadID,
        this._settings.dbHistoryConfig
      );

      const chain = await this._chainService.build(
        this._llm,
        args?.question,
        chatHistory.getChatHistory(),
        args?.context
      );

      const chatMessages = await chatHistory.getMessages();

      const result = await chain.invoke(
        {
          ...args,
          query: args?.question,
          user_context: args?.context,
          user_prompt: this._settings?.systemMesssage,
          history: chatMessages,
          format_chat_messages: await chatHistory.getFormatedMessages(
            chatMessages
          ),
        },
        { configurable: { sessionId: args?.chatThreadID || nanoid() } }
      );

      this.emit(EVENTS_NAME.onMessage, result);
      this.emit(EVENTS_NAME.onEnd, 'terminated');
    } catch (error) {
      this._logger.error(error);
      this.emit(EVENTS_NAME.onError, error);
    } finally {
      return;
    }
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

export default Agent;
