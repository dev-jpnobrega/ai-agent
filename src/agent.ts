import { BaseLanguageModel } from '@langchain/core/language_models/base';

import AgentBaseCommand from './agent.base';
import {
  IAgent,
  IAgentConfig,
  IDatabaseConfig,
  IInputProps,
} from './interface/agent.interface';

import { nanoid } from 'ai';
import { ChainService, IChainService } from './services/chain';
import { ChatHistoryFactory, IChatHistory } from './services/chat-history';
import LLMFactory from './services/llm';
// Removed duplicate import

const EVENTS_NAME = {
  onMessage: 'onMessage',
  onToken: 'onToken',
  onEnd: 'onEnd',
  onError: 'onError',
  onMessageSystem: 'onMessageSystem',
  onMessageHuman: 'onMessageHuman',
};

class Agent extends AgentBaseCommand implements IAgent {
  private _name: string;
  private _llm: BaseLanguageModel;

  private _chainService: IChainService;

  private _chatHistory: IChatHistory;
  private _logger: Console;
  private _settings: IAgentConfig;

  constructor(settings: IAgentConfig) {
    super();

    this._logger = console;
    this._settings = settings;

    this.setup(settings);
  }

  private setup(settings: IAgentConfig): void {
    this._name = settings?.name || 'AssistentAgent';
    this._llm = LLMFactory.create(settings.chatConfig, settings.llmConfig);
    this._chainService = new ChainService(settings);
  }

  private async buildHistory(
    userSessionId: string,
    settings: IDatabaseConfig
  ): Promise<IChatHistory> {
    if (this._chatHistory) return this._chatHistory;

    this._chatHistory = await ChatHistoryFactory.create({
      ...settings,
      sessionId: userSessionId || nanoid(), // TODO
    });

    return this._chatHistory;
  }

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
        { configurable: { sessionId: args?.chatThreadID } }
      );

      // await chatHistory.addUserMessage(question);
      // await chatHistory.addAIMessage(result);

      this.emit(EVENTS_NAME.onMessage, result);

      this.emit(EVENTS_NAME.onEnd, 'terminated');
    } catch (error) {
      this._logger.error(error);
      this.emit(EVENTS_NAME.onError, error);
    } finally {
      return;
    }
  }

  execute(args: any): Promise<void> {
    throw new Error(args);
  }
}

export default Agent;
