
import { BaseChatModel } from 'langchain/chat_models/base';
import { BaseChain, SequentialChain, loadQAMapReduceChain } from 'langchain/chains';

import { BasePromptTemplate, ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate } from 'langchain/prompts';

import { IAgentConfig, SYSTEM_MESSAGE_DEFAULT } from '../../interface/agent.interface';
import SqlChain from './sql-chain';
import OpenAPIChain from './openapi-chain';

interface IChain {
  create(llm: BaseChatModel, ...args: any): Promise<BaseChain>
}

interface IChainService {
  build(llm: BaseChatModel, ...args: any): Promise<BaseChain>
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
      --------------------------------------
      Context found in documents:
      {summaries}
      --------------------------------------
      Name of reference files:
      {referencies}
    `;

    if (this._isSQLChainEnabled) {
      builtMessage += `
        --------------------------------------
        This was the answer found in the database:
        {sqlResult}\n
        --------------------------------------
        Query executed:
        {sqlQuery}\n
      `;
    }
  
    if (this._isOpenAPIChainEnabled) {
      builtMessage += `
        --------------------------------------
        This was the answer found in the API:
        {openAPIResult}\n
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

  private async buildChains(llm: BaseChatModel, ...args: any): Promise<BaseChain[]> {
    const enabledChains = this.checkEnabledChains(this._settings);

    const chainQA = loadQAMapReduceChain(llm, {
      combinePrompt: this.buildPromptTemplate(
        this._settings.systemMesssage || SYSTEM_MESSAGE_DEFAULT,
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
    const chains = await this.buildChains(llm, args);

    const enhancementChain = new SequentialChain({
      chains,
      inputVariables: [
        'query', 'referencies', 'input_documents', 'question', 'chat_history',
      ],
      verbose: this._settings.debug || false,
    });


    return enhancementChain;
  }
}

export { ChainService, IChainService, IChain };