import {
  BaseChain,
  SequentialChain,
  loadQAMapReduceChain,
} from 'langchain/chains';

import { BaseLanguageModel } from '@langchain/core/language_models/base';

import {
  BasePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  AIMessagePromptTemplate,
} from '@langchain/core/prompts';

import {
  IAgentConfig,
  SYSTEM_MESSAGE_DEFAULT,
} from '../../interface/agent.interface';
import OpenAPIChain from './openapi-chain';
import SqlChain from './sql-chain';

import {
  RunnablePassthrough,
  RunnableSequence,
  RunnableWithMessageHistory,
} from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

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
  ): Promise<RunnableSequence<any, any>>;
}

class ChainService {
  private _settings: IAgentConfig;
  private _isSQLChainEnabled: boolean;
  private _isOpenAPIChainEnabled: boolean;
  private _isVectorStoreEnabled: boolean;

  constructor(settings: IAgentConfig) {
    this._settings = settings;
  }

  private checkEnabledChains(settings: IAgentConfig): IChain[] {
    const enabledChains: IChain[] = [];

    if (settings.vectorStoreConfig) {
      this._isVectorStoreEnabled = true;
      enabledChains.push(new VectorStoreChain(settings.vectorStoreConfig));
    }

    if (settings.dataSourceConfig) {
      this._isSQLChainEnabled = true;
      enabledChains.push(new SqlChain(settings.dataSourceConfig));
    }

    if (settings.openAPIConfig) {
      this._isOpenAPIChainEnabled = true;
      enabledChains.push(new OpenAPIChain(settings.openAPIConfig));
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
      5. Database output (from database result), if available. If database output is filled, use it for final answer, do not manipulate.\n\n\n\n
      
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
      - Document Context: {relevant_docs}\n
      - Reference Files: {referencies}\n
    `;

    if (this._isSQLChainEnabled) {
      builtMessage += `
        - Database Result: {sqlResult}\n
        - Query executed: {sqlQuery}\n
      `;
    }

    builtMessage += `
      Question:\n
      - {question}\n
    `;

    if (this._isVectorStoreEnabled) {
      builtMessage += `
        --------------------------------------
        Context found in documents: {relevant_docs}\n
        --------------------------------------
        Name of reference files: {referencies}\n    
      `;
    }

    if (this._isOpenAPIChainEnabled) {
      builtMessage += `
        --------------------------------------
        API Result: {openAPIResult}\n
        --------------------------------------
      `;
    }

    // builtMessage += `\n\nQUESTION: {question}`;

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

  private async buildChains(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any>> {
    const enabledChains = this.checkEnabledChains(this._settings);

    const prompt = this.buildPromptTemplate();

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    /*
    const chainQA = loadQAMapReduceChain(llm as unknown as BLMOld, {
      combinePrompt: this.buildPromptTemplate(
        this._settings.systemMesssage || SYSTEM_MESSAGE_DEFAULT
      ),
    });

    const chains = await Promise.all(
      enabledChains.map(
        async (chain: IChain) => await chain.create(llm, ...args)
      )
    );
    */
    const chainSQL = await new SqlChain(this._settings.dataSourceConfig).create(
      llm,
      ...args
    );

    const run = RunnableSequence.from([
      RunnablePassthrough.assign({
        chainSQL,
      }),
      RunnablePassthrough.assign({
        sqlResult: (input) => input.chainSQL.sqlResult,
        sqlQuery: (input) => input.chainSQL.sqlQuery,
      }),
      chain,
      llm,
      new StringOutputParser(),
    ]);

    return run;
  }

  public async build(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any>> {
    const [, chatHistory] = args;
    const runnable = await this.buildChains(llm, ...args);

    const chainWithHistory = new RunnableWithMessageHistory({
      runnable,
      getMessageHistory: (sessionID) => {
        return chatHistory;
      },
      inputMessagesKey: 'question',
      historyMessagesKey: 'history',
    });

    /*
    const enhancementChain = new SequentialChain({
      chains,
      inputVariables: [
        'query',
        'referencies',
        'relevant_docs',
        'input_documents',
        'question',
        'chat_history',
        'format_chat_messages',
        'user_prompt',
        'user_context',
      ],
      verbose: this._settings.debug || false,
      memory: memoryChat,
    });
    */

    return chainWithHistory;
  }
}

export { ChainService, IChain, IChainService };
