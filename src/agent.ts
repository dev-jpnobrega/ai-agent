import { BaseChatModel } from 'langchain/chat_models/base';
import { BufferMemory } from 'langchain/memory';
import { VectorStore } from 'langchain/vectorstores/base';

import AgentBaseCommand from './agent.base';
import { IAgentConfig, IDatabaseConfig, IInputProps, IAgent, IVectorStoreConfig } from './interface/agent.interface';

import VectorStoreFactory from './services/vector-store';
import ChatHistoryFactory from './services/chat-history';
import LLMFactory from './services/llm';
import { ChainService, IChainService } from './services/chain';
import { nanoid } from 'ai';

const EVENTS_NAME = {
  onMessage: 'onMessage',
  onToken: 'onToken',
  onEnd: 'onEnd',
  onError: 'onError',
  onMessageSystem: 'onMessageSystem',
  onMessageHuman: 'onMessageHuman'
};

class Agent extends AgentBaseCommand implements IAgent {
  private _name: string;
  private _llm: BaseChatModel;
  private _vectorService: VectorStore;

  private _chainService: IChainService;
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
      this._vectorService = VectorStoreFactory.create(settings.vectorStoreConfig);
  }
 
  private async buildHistory(userSessionId: string, settings: IDatabaseConfig): Promise<BufferMemory> {
    if (this._bufferMemory && !settings)
      return this._bufferMemory;
    
    if (!this._bufferMemory && !settings) {
      this._bufferMemory = new BufferMemory({ returnMessages: true, memoryKey: 'chat_history' });
      
      return this._bufferMemory;
    }

    this._bufferMemory = new BufferMemory({
      returnMessages: true,
      memoryKey: 'chat_history',
      chatHistory: await ChatHistoryFactory.create({
        ...settings,
        sessionId: userSessionId || nanoid(), // TODO
      }), 
    });

    return this._bufferMemory;
  }

  private async buildRelevantDocs(question: string, settings: IVectorStoreConfig): Promise<any> {
    if (!settings) return { relevantDocs: [], referenciesDocs: [] };

    const relevantDocs = await this._vectorService.similaritySearch(question, 10, {
      vectorFields: settings.vectorFieldName,
      filter: `index: ${settings.indexes[0]}` // `user eq '${1}' and chatThreadId eq 'global'`, // TODO
    });

    const referenciesDocs = relevantDocs.map((doc: { metadata: unknown; }) => doc.metadata).join(', ');

    return { relevantDocs, referenciesDocs };
  }

  async call(args: IInputProps): Promise<void> {
    const { question, chatThreadID } = args;

    try {
      const memoryChat = await this.buildHistory(chatThreadID, this._settings.dbHistoryConfig);

      memoryChat.chatHistory?.addUserMessage(question);

      const { relevantDocs, referenciesDocs } = await this.buildRelevantDocs(question, this._settings.vectorStoreConfig);

      const chain = await this._chainService.build(this._llm, question);
  
      const result = await chain.call({
        referencies: referenciesDocs,
        input_documents: relevantDocs,
        query: question,
        question: question,
        chat_history: await memoryChat.chatHistory?.getMessages(),
      });

      await memoryChat.chatHistory?.addAIChatMessage(result?.text);

      this.emit(EVENTS_NAME.onMessage, result?.text);
  
      this.emit(EVENTS_NAME.onEnd, 'terminated');
    } catch (error) {
      this._logger.error(error);
      this.emit(EVENTS_NAME.onError, error);
    } finally {
      return;
    }
  }

  private handleLLMNewToken(token: any) {
    this.emit(EVENTS_NAME.onToken, token);
  };

  execute(args: any): Promise<void> {
    throw new Error(args);
  }
}


export default Agent;
