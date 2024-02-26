import { BaseChatModel } from 'langchain/chat_models/base';
import { VectorStore } from 'langchain/vectorstores/base';

import { CallbackHandler } from "langfuse-langchain";

import AgentBaseCommand from './agent.base';
import {
  IAgent,
  IAgentConfig,
  IDatabaseConfig,
  IInputProps,
  IVectorStoreConfig,
} from './interface/agent.interface';

import { nanoid } from 'ai';
import { interpolate } from './helpers/string.helpers';
import { ChainService, IChainService } from './services/chain';
import { ChatHistoryFactory, IChatHistory } from './services/chat-history';
import LLMFactory from './services/llm';
import VectorStoreFactory from './services/vector-store';
import { CallbackHandlerMethods } from 'langchain/callbacks';

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
  private _llm: BaseChatModel;
  private _vectorService: VectorStore;

  private _chainService: IChainService;

  private _chatHistory: IChatHistory;
  private _logger: Console;
  private _settings: IAgentConfig;
  private _handlerMonitor: CallbackHandler;

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
    this._handlerMonitor = new CallbackHandler({
      publicKey: `pk-lf-65e808ec-b3ad-45da-8fca-a7790b8702e7`,
      secretKey: `sk-lf-a481149c-3f8c-4c6b-9bb9-3889450893b6`,
      baseUrl: `https://cloud.langfuse.com`,
    });

    if (settings?.vectorStoreConfig) {
      this._vectorService = VectorStoreFactory.create(
        settings.vectorStoreConfig,
        settings.llmConfig
      );
    }  
  }

  private async buildHistory(
    userSessionId: string,
    settings: IDatabaseConfig
  ): Promise<IChatHistory> {
    if (this._chatHistory) return this._chatHistory;

    this._chatHistory = await ChatHistoryFactory.create({
      ...settings,
      sessionId: userSessionId || nanoid(), // TODO
    })

    return this._chatHistory;
  }

  private async buildRelevantDocs(
    args: IInputProps,
    settings: IVectorStoreConfig
  ): Promise<any> {
    if (!settings) return { relevantDocs: [], referenciesDocs: [] };

    const { customFilters = null } = settings;

    const relevantDocs = await this._vectorService.similaritySearch(
      args.question,
      10,
      {
        vectorFields: settings.vectorFieldName,
        filter: customFilters
          ? interpolate<IInputProps>(customFilters, args)
          : '',
      }
    );

    const referenciesDocs = relevantDocs
      .map((doc: { metadata: unknown }) => doc.metadata)
      .join(', ');

    return { relevantDocs, referenciesDocs };
  }

  async call(args: IInputProps): Promise<void> {
    const { question, chatThreadID } = args;

    try {
      const chatHistory = await this.buildHistory(
        chatThreadID,
        this._settings.dbHistoryConfig
      );

      const { relevantDocs, referenciesDocs } = await this.buildRelevantDocs(
        args,
        this._settings.vectorStoreConfig
      );

      const chain = await this._chainService.build(
        this._llm,
        question,
        chatHistory.getBufferMemory(),
      );

      const chatMessages = await chatHistory.getMessages();

      const result = await chain.call({
        referencies: referenciesDocs,
        input_documents: relevantDocs,
        query: question,
        question: question,
        chat_history: chatMessages,
        format_chat_messages: chatHistory.getFormatedMessages(chatMessages),
        user_prompt: this._settings.systemMesssage,
      }, { callbacks: [this._handlerMonitor as CallbackHandlerMethods ] });

      await chatHistory.addUserMessage(question);
      await chatHistory.addAIChatMessage(result?.text);

      this.emit(EVENTS_NAME.onMessage, result?.text);

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
