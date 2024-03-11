import {
  BaseChain,
  SequentialChain,
  loadQAMapReduceChain,
} from 'langchain/chains';
import { BaseChatModel } from 'langchain/chat_models/base';

import {
  BasePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from 'langchain/prompts';

import {
  IAgentConfig,
  SYSTEM_MESSAGE_DEFAULT,
} from '../../interface/agent.interface';
import OpenAPIChain from './openapi-chain';
import SqlChain from './sql-chain';

interface IChain {
  create(llm: BaseChatModel, ...args: any): Promise<BaseChain>;
}

interface IChainService {
  build(llm: BaseChatModel, ...args: any): Promise<BaseChain>;
}

class ChainService {
  private _settings: IAgentConfig;
  private _isSQLChainEnabled: boolean;
  private _isOpenAPIChainEnabled: boolean;

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

    return enabledChains;
  }

  private buildSystemMessages(systemMessages: string): string {
    let builtMessage = systemMessages;

    builtMessage += '\n';
    builtMessage += `
      Given the user prompt and conversation log, the document context, the API output, and the following database output, formulate a response from a knowledge base.\n
      You must follow the following rules and priorities when generating and responding:\n
      - Always prioritize user prompt over conversation record.\n
      - Ignore any conversation logs that are not directly related to the user prompt.\n
      - Only try to answer if a question is asked.\n
      - The question must be a single sentence.\n
      - You must remove any punctuation from the question.\n
      - You must remove any words that are not relevant to the question.\n
      - If you are unable to formulate a question, respond in a friendly manner so the user can rephrase the question.\n\n

      USER PROMPT: {user_prompt}\n
      --------------------------------------
      CHAT HISTORY: {format_chat_messages}\n
      --------------------------------------
      Context found in documents: {summaries}\n
      --------------------------------------
      Name of reference files: {referencies}\n
    `;

    if (this._isSQLChainEnabled) {
      builtMessage += `
        --------------------------------------
        Database Result: {sqlResult}\n
        Query executed: {sqlQuery}\n
        --------------------------------------
      `;
    }

    if (this._isOpenAPIChainEnabled) {
      builtMessage += `
        --------------------------------------
        API Result: {openAPIResult}\n
        --------------------------------------
      `;
    }

    return builtMessage;
  }

  private buildPromptTemplate(systemMessages: string): BasePromptTemplate {
    const combine_messages = [
      SystemMessagePromptTemplate.fromTemplate(
        this.buildSystemMessages(systemMessages)
      ),
      new MessagesPlaceholder('chat_history'),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ];

    const CHAT_COMBINE_PROMPT =
      ChatPromptTemplate.fromPromptMessages(combine_messages);

    return CHAT_COMBINE_PROMPT;
  }

  private async buildChains(
    llm: BaseChatModel,
    ...args: any
  ): Promise<BaseChain[]> {
    const enabledChains = this.checkEnabledChains(this._settings);

    const chainQA = loadQAMapReduceChain(llm, {
      combinePrompt: this.buildPromptTemplate(
        this._settings.systemMesssage || SYSTEM_MESSAGE_DEFAULT
      ),
    });

    const chains = await Promise.all(
      enabledChains.map(
        async (chain: IChain) => await chain.create(llm, ...args)
      )
    );

    return chains.concat(chainQA);
  }

  public async build(llm: BaseChatModel, ...args: any): Promise<BaseChain> {
    const { memoryChat } = args;
    const chains = await this.buildChains(llm, args);

    const enhancementChain = new SequentialChain({
      chains,
      inputVariables: [
        'query',
        'referencies',
        'input_documents',
        'question',
        'chat_history',
        'format_chat_messages',
        'user_prompt',
      ],
      verbose: this._settings.debug || false,
      memory: memoryChat,
    });

    return enhancementChain;
  }
}

export { ChainService, IChain, IChainService };

