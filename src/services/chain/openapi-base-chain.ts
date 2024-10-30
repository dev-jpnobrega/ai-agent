import { BaseChain, ChainInputs, createOpenAPIChain } from 'langchain/chains';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BasePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';

export interface OpenApiBaseChainInput extends ChainInputs {
  spec: string;
  llm?: BaseChatModel;
  customizeSystemMessage?: string;
  headers: Record<string, string>;
}

export class OpenApiBaseChain extends BaseChain {
  readonly inputKey = 'query';
  readonly outputKey = 'openAPIResult';
  private _input: OpenApiBaseChainInput;
  private _logger: Console;

  constructor(input: OpenApiBaseChainInput) {
    super(input);
    this._input = input;
    this._logger = console;
  }

  get inputKeys(): string[] {
    return [this.inputKey];
  }

  get outputKeys(): string[] {
    return [this.outputKey];
  }

  private getOpenApiPrompt(): string {
    return `
      You are an AI with expertise in OpenAPI and Swagger.\n
      You should follow the following rules when generating and answer:\n
      - Only execute the request on the service if the question is not in CHAT HISTORY, if the question has already been answered, use the same answer and do not make a request on the service.
      - Only attempt to answer if a question was posed.\n
      - Always answer the question in the language in which the question was asked.\n\n
      -------------------------------------------\n
      USER PROMPT: {user_prompt}\n
      -------------------------------------------\n
      SCHEMA: {schema}\n
      -------------------------------------------\n
      CHAT HISTORY: {format_chat_messages}\n
      -------------------------------------------\n
      QUESTION: {question}\n
      ------------------------------------------\n
      API ANSWER:
    `;
  }

  private buildPromptTemplate(systemMessages: string): BasePromptTemplate {
    const combine_messages = [
      SystemMessagePromptTemplate.fromTemplate(systemMessages),
      new MessagesPlaceholder('chat_history'),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ];

    const CHAT_COMBINE_PROMPT =
      ChatPromptTemplate.fromPromptMessages(combine_messages);

    return CHAT_COMBINE_PROMPT;
  }

  private tryParseText(text: string): string {
    if (text.includes('No function_call in message')) {
      try {
        const txtSplitJson = text.split('No function_call in message ')[1];
        const txtJson = JSON.parse(txtSplitJson);

        return txtJson[0]?.text;
      } catch (error) {
        return `Sorry, I could not find the answer to your question.`;
      }
    }

    return text;
  }

  async _call(values: any, runManager?: any): Promise<any> {
    this._logger.log('Values: ', values);
    this._logger.log('OPENAPI Input: ', values[this.inputKey]);

    const question = values[this.inputKey];
    const schema = this._input.spec;

    const chain = await createOpenAPIChain(this._input.spec, {
      llm: this._input.llm,
      prompt: this.buildPromptTemplate(this.getOpenApiPrompt()),
      headers: this._input.headers,
      verbose: true,
    });

    let answer: string = '';

    try {
      const rs = await chain.invoke({
        question,
        schema,
        chat_history: values?.chat_history,
        format_chat_messages: values?.format_chat_messages,
        user_prompt: this._input.customizeSystemMessage || '',
      });

      this._logger.log('OPENAPI Resposta: ', answer);

      answer = rs?.response;
    } catch (error) {
      this._logger.error('OPENAPI Error: ', error);

      answer = this.tryParseText(error?.message);
    } finally {
      return { [this.outputKey]: answer };
    }
  }

  _chainType(): string {
    return 'open_api_chain' as const;
  }
}
