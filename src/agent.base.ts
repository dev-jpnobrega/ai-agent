import { EventEmitter } from 'events';
import {
  IAgentConfig,
  IDatabaseConfig,
  IInputProps,
} from './interface/agent.interface';
import { ChatHistoryFactory, IChatHistory } from './services/chat-history';
import Monitor from './services/monitor';

class AgentBase extends EventEmitter {
  /**
   * The logger used for logging messages.
   */
  _logger: Console;

  /**
   * The name of the agent.
   */
  name: string;

  /**
   * The configuration settings for the agent.
   */
  _settings: IAgentConfig;

  /**
   * The chat history associated with the agent.
   */
  _chatHistory?: IChatHistory;

  constructor(settings: IAgentConfig) {
    super();
    this.name = settings?.name || 'AssistantAgent';
    this._logger = console;
    this._settings = settings;

    Monitor.add(settings?.monitor);
  }

  /**
   * Builds the chat history for the given user session.
   * @param userSessionId - The ID of the user session.
   * @param settings - The database configuration settings.
   * @returns A promise that resolves to the chat history.
   */
  async buildHistory(
    userSessionId: string,
    settings: IDatabaseConfig,
  ): Promise<IChatHistory> {
    if (this._chatHistory) return this._chatHistory;

    this._chatHistory = await ChatHistoryFactory.create({
      ...settings,
      sessionId: userSessionId,
    });

    return this._chatHistory;
  }

  async call(args: IInputProps): Promise<void> {
    throw new Error('Method not implemented.');
  }

  execute(args: any): Promise<void> {
    throw new Error('Method not implemented.');
  }

  dispose(): void {
    if (this._chatHistory) {
      this._chatHistory.closeConnection();
      this._chatHistory = undefined;
    }
  }
}

export default AgentBase;
