import { BaseLanguageModel } from '@langchain/core/language_models/base';

import {
  BasePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  AIMessagePromptTemplate,
} from '@langchain/core/prompts';

import { IAgentConfig } from '../../interface/agent.interface';
import OpenAPIChain from './openapi-chain';
import SqlChain from './sql-chain';
import VectorStoreChain from './vector-store-chain';
import McpChain from './mcp-client-chain';

import {
  Runnable,
  RunnableLike,
  RunnableSequence,
  RunnableWithMessageHistory,
} from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseListChatMessageHistory } from '@langchain/core/chat_history';

interface IChain {
  create(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any>>;
}

interface IChainService {
  build(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableWithMessageHistory<any, any>>;

  buildRunnableWithMessageHistory(
    runnable: RunnableSequence<any, any> | Runnable,
    chatHistory: BaseListChatMessageHistory
  ): Promise<RunnableWithMessageHistory<any, any>>;
}

class ChainService {
  private _settings: IAgentConfig;
  private _isSQLChainEnabled: boolean;
  private _isOpenAPIChainEnabled: boolean;
  private _isVectorStoreEnabled: boolean;
  private _isMcpChainEnabled: boolean;

  constructor(settings: IAgentConfig) {
    this._settings = settings;
  }

  private checkEnabledChains(settings: IAgentConfig): IChain[] {
    const enabledChains: IChain[] = [];

    if (settings.dataSourceConfig) {
      this._isSQLChainEnabled = true;
      enabledChains.push(new SqlChain(settings.dataSourceConfig));
    }

    if (settings.openAPIConfig) {
      this._isOpenAPIChainEnabled = true;
      enabledChains.push(new OpenAPIChain(settings.openAPIConfig));
    }

    if (settings.vectorStoreConfig) {
      this._isVectorStoreEnabled = true;
      enabledChains.push(new VectorStoreChain(settings));
    }

    if (settings.mcpServerConfig) {
      this._isMcpChainEnabled = true;
      enabledChains.push(new McpChain(settings));
    }

    return enabledChains;
  }

  private buildSystemMessages(): string {
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
      - User Rules: {user_prompt}\n
      - User Context: {user_context}\n
    `;

    if (this._isSQLChainEnabled) {
      builtMessage += `
        - Database Result: {sqlResult}\n
        - Query executed: {sqlQuery}\n
      `;
    }

    if (this._isVectorStoreEnabled) {
      builtMessage += `
        - Document Context: {relevantDocs}\n
      `;
    }
    // - Reference Files: {referencies}\n
    if (this._isOpenAPIChainEnabled) {
      builtMessage += `
        - API Result: {openAPIResult}\n
      `;
    }

    if (this._isMcpChainEnabled) {
      builtMessage += `
        - MCP Tool Result: {mcpToolsResult}\n
      `;
    }

    builtMessage += `
      Question:\n
      - {question}\n
    `;

    return builtMessage;
  }

  private buildPromptTemplate(): BasePromptTemplate {
    const combine_messages = [
      SystemMessagePromptTemplate.fromTemplate(this.buildSystemMessages()),
      new MessagesPlaceholder('history'),
      AIMessagePromptTemplate.fromTemplate('Hello! How can I help?'),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ];

    const CHAT_COMBINE_PROMPT =
      ChatPromptTemplate.fromMessages(combine_messages);

    return CHAT_COMBINE_PROMPT;
  }

  private async createChains(
    enabledChains: IChain[],
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableLike<any, any>[] | Runnable> {
    const prompt = this.buildPromptTemplate();

    const chainQA = prompt.pipe(llm).pipe(new StringOutputParser());

    const chains: RunnableLike<any, any>[] = await Promise.all(
      enabledChains.map(
        async (chain: IChain) => await chain.create(llm, ...args)
      )
    );

    if (chains.length === 0) return chainQA;

    chains.push(chainQA);

    return chains;
  }

  private async buildChains(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any> | Runnable> {
    const enabledChains = this.checkEnabledChains(this._settings);

    const chains = await this.createChains(enabledChains, llm, ...args);

    if (chains instanceof Runnable) return chains;

    return RunnableSequence.from(
      chains as [
        RunnableLike<any, any>,
        ...RunnableLike<any, any>[],
        RunnableLike<any, string>
      ]
    );
  }

  public async buildRunnableWithMessageHistory(
    runnable: RunnableSequence<any, any> | Runnable,
    chatHistory: BaseListChatMessageHistory
  ) {
    const chainWithHistory = new RunnableWithMessageHistory({
      runnable,
      getMessageHistory: (_) => {
        return chatHistory;
      },
      inputMessagesKey: 'question',
      historyMessagesKey: 'history',
    });

    return chainWithHistory;
  }

  public async build(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableWithMessageHistory<any, any>> {
    const [, chatHistory] = args;
    const runnable = await this.buildChains(llm, ...args);

    const chainWithHistory = await this.buildRunnableWithMessageHistory(
      runnable,
      chatHistory
    );

    return chainWithHistory;
  }
}

export { ChainService, IChain, IChainService };
