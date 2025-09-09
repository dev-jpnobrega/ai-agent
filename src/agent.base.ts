import { EventEmitter } from 'events';
import {
  IAgentConfig,
  IAgentExecutor,
  IDatabaseConfig,
  IInputProps,
} from './interface/agent.interface';
import { ChatHistoryFactory, IChatHistory } from './services/chat-history';

class AgentBase extends EventEmitter {
  /**
   * The logger used for logging messages.
   */
  _logger: Console;

  /**
   * The name of the agent.
   */
  _name: string;

  /**
   * The configuration settings for the agent.
   */
  _settings: IAgentConfig;

  /**
   * The chat history associated with the agent.
   */
  _chatHistory: IChatHistory;

  constructor(settings: IAgentConfig) {
    super();
    this._name = settings.name;
    this._logger = console;
    this._settings = settings;

    this.setMonitor(settings);
  }

  /**
   * Configures the monitoring settings for the agent.
   * If monitoring is enabled in the provided settings, it sets up the necessary
   * environment variables for LangChain tracing and logging.
   *
   * @param {IAgentConfig} settings - The configuration settings for the agent.
   * @param {boolean} settings.monitor - Flag indicating if monitoring is enabled.
   * @param {string} settings.monitor.endpoint - The endpoint for the monitoring service.
   * @param {string} settings.monitor.apiKey - The API key for the monitoring service.
   * @param {string} settings.monitor.projectName - The project name for the monitoring service.
   * @returns {void}
   */
  private setMonitor(settings: IAgentConfig): void {
    if (!settings?.monitor) {
      process.env.LANGCHAIN_TRACING_V2 = `false`;
      process.env.LANGCHAIN_ENDPOINT = undefined;
      process.env.LANGCHAIN_API_KEY = undefined;
      process.env.LANGCHAIN_PROJECT = undefined;

      return;
    }

    this._logger.log(
      `Monitor enabled Agent ${this._name} project ${settings.monitor?.projectName}`
    );

    const { monitor } = settings;

    process.env.LANGCHAIN_TRACING_V2 = `true`;
    process.env.LANGCHAIN_ENDPOINT = monitor.endpoint;
    process.env.LANGCHAIN_API_KEY = monitor.apiKey;
    process.env.LANGCHAIN_PROJECT = monitor.projectName;
  }

  /**
   * Builds the chat history for the given user session.
   * @param userSessionId - The ID of the user session.
   * @param settings - The database configuration settings.
   * @returns A promise that resolves to the chat history.
   */
  async buildHistory(
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

  async call(args: IInputProps): Promise<void> {
    throw new Error('Method not implemented.');
  }
  execute(args: any): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export default AgentBase;
