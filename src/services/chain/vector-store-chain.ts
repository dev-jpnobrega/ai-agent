import { VectorStore } from '@langchain/core/vectorstores';
import {
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import {
  AIMessagePromptTemplate,
  BasePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';

import { IAgentConfig, IInputProps } from '../../interface/agent.interface';
import { IChain } from '.';

import VectorStoreFactory from '../vector-store';
import { interpolate } from '../../helpers/string.helper';

class VectorStoreChain implements IChain {
  private _settings: IAgentConfig;
  private _outputKey = 'relevantDocs';
  private _service: VectorStore;
  private _llm: BaseLanguageModel;
  private _runName: string;
  private _runId: string;

  constructor(settings: IAgentConfig) {
    this._settings = settings;
  }

  private getVectorStorePrompt(): string {
    return `
      Given the following inputs, formulate a concise and relevant response:\n
      1. User Rules (from USER CONTEXT > USER RULES), if provided\n
      2. User Context (from USER CONTEXT > CONTEXT), if available\n
      3. Document Context (from Context found in documents), if provided\n
      4. API Output (from API Result), if available\n
      5. Database output (from database result), if available. If database output is filled, use it for final answer, do not manipulate.\n\n\n\n
      
      Response Guidelines:\n
      - Prioritize User Rules and User Context if they are filled in.\n
      - Do not generate or fabricate information:\n
        Only use the data explicitly provided in the User Rules, User Context and Document Context. If the necessary information is not available, inform the user that the data is missing or request more details. Do not speculate or make assumptions beyond the provided information.\n
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
      - Document Context: {context}\n
    `;
  }

  private buildPromptTemplate(systemMessages: string): BasePromptTemplate {
    const combine_messages = [
      SystemMessagePromptTemplate.fromTemplate(systemMessages),
      new MessagesPlaceholder('history'),
      AIMessagePromptTemplate.fromTemplate(
        'Wait! We are searching our VectorStore API.'
      ),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
    ];

    const CHAT_COMBINE_PROMPT =
      ChatPromptTemplate.fromMessages(combine_messages);

    return CHAT_COMBINE_PROMPT;
  }

  private async executeAsRetrieval(input: any) {
    const prompt = this.buildPromptTemplate(this.getVectorStorePrompt());

    return new Promise(async (resolve, reject) => {
      try {
        const combineDocsChain = await createStuffDocumentsChain({
          llm: this._llm,
          prompt,
        });

        const chain = await createRetrievalChain({
          retriever: this._service.asRetriever({
            verbose: this._settings?.debug || false,
            k: this._settings.vectorStoreConfig?.top || 10,
            filter: this._settings.vectorStoreConfig?.customFilters
              ? interpolate<IInputProps>(
                  this._settings.vectorStoreConfig?.customFilters,
                  input
                )
              : '',
          }),
          combineDocsChain,
        });

        const response = await chain.invoke(
          {
            verbose: this._settings?.debug || false,
            input: input.input,
            history: input.history,
            ...input,
          },
          {
            runName: this._runName,
            runId: this._runId,
            configurable: { sessionId: input?.chat_thread_id },
          }
        );

        return resolve(response);
      } catch (error) {
        console.error('Error executing as retrieval', error);
        return reject(error);
      }
    });
  }

  private async buildVectorStoreChain(): Promise<RunnableSequence<any, any>> {
    const runnable = RunnableSequence.from([
      {
        chat_thread_id: (input: any) => input.chat_thread_id,
        user_prompt: (input) => input.user_prompt,
        user_context: (input: any) => input.user_context,
        history: (input: any) => input.history,
        input: (input: any) => input.question,
        format_chat_messages: (input) => input.format_chat_messages,
      },
      {
        chat_thread_id: (input: any) => input.chat_thread_id,
        user_prompt: (input) => input.user_prompt,
        user_context: (input: any) => input.user_context,
        history: (input: any) => input.history,
        input: (input: any) => input.question,
        format_chat_messages: (input) => input.format_chat_messages,
        response: this.executeAsRetrieval.bind(this),
      },
      {
        [this._outputKey]: (previousStepResult: any) => {
          return {
            resume: previousStepResult?.response?.answer,
            context: previousStepResult?.response?.context,
          };
        },
      },
    ]);

    return runnable;
  }

  public async create(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any>> {
    const [, , , runId, runName] = args;
    this._runName = runName;
    this._runId = runId;
    this._llm = llm;
    this._service = VectorStoreFactory.create(
      this._settings.vectorStoreConfig,
      this._settings.llmConfig
    );

    const vectorStoreChain = await this.buildVectorStoreChain();

    return RunnableSequence.from([
      RunnablePassthrough.assign({
        vectorStoreChain,
      }),
      RunnablePassthrough.assign({
        [this._outputKey]: (input: { vectorStoreChain: any }) => {
          return input.vectorStoreChain[this._outputKey];
        },
      }),
    ]);
  }
}

export default VectorStoreChain;
