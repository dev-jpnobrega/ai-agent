import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { BufferMemory } from 'langchain/memory';
import { VectorStore } from 'langchain/vectorstores/base';

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
  private _vectorService: VectorStore;

  private _chainService: IChainService;

  private _chatHistory: IChatHistory;
  private _bufferMemory: BufferMemory;
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

    if (settings?.vectorStoreConfig)
      this._vectorService = VectorStoreFactory.create(
        settings.vectorStoreConfig,
        settings.llmConfig
      );
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

    const referenciesObjDocs: any = {};
    relevantDocs.map(
      (doc: { metadata: any }) =>
        (referenciesObjDocs[doc.metadata] = doc.metadata)
    );

    return {
      relevantDocs: relevantDocs.map((doc: any) => doc.pageContent).join('\n'),
      referenciesDocs: Object.values(referenciesObjDocs),
    };
  }

  async call(args: IInputProps): Promise<void> {
    const { question, chatThreadID, context: userContext } = args;

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
        chatHistory.getChatHistory(),
        userContext
      );

      const chatMessages = await chatHistory.getMessages();

      const result = await chain.invoke(
        {
          referencies: referenciesDocs,
          relevant_docs: relevantDocs,
          input_documents: [],
          query: question,
          question: question,
          user_context: userContext,
          history: chatMessages,
          format_chat_messages: await chatHistory.getFormatedMessages(
            chatMessages
          ),
          user_prompt: this._settings.systemMesssage,
        },
        { configurable: { sessionId: chatThreadID } }
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
