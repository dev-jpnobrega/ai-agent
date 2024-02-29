import { CallbackManagerForChainRun } from 'langchain/callbacks';
import { BaseChain, ChainInputs } from 'langchain/chains';
import { BaseChatModel } from 'langchain/chat_models/base';
import { BaseFunctionCallOptions } from 'langchain/dist/base_language';
import {
  BasePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from 'langchain/prompts';
import { ChainValues } from 'langchain/schema';
import { RunnableSequence } from 'langchain/schema/runnable';
import type { OpenAPIV3_1 } from 'openapi-types';

export interface OpenApiBaseChainInput extends ChainInputs {
  spec: string | OpenAPIV3_1.Document<{}>;
  llm?: BaseChatModel<BaseFunctionCallOptions>;
  customizeSystemMessage?: string;
  headers: Record<string, string>;
  timeout?: number;
}

interface IRequest {
  url: string;
  contentType?: string;
  requestMethod?: string;
  data: object;
}

interface IResponseHeaders {
  [key: string]: string;
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
      - Always answer the question in the language in which the question was asked.\n
      - The response must be an json object contains an url, contentType, requestMethod and data.\n\n
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

  configureTimeout(timeout: number) {
    let timeoutId = null;
    const controller = new AbortController();
    const { signal } = controller;

    if (timeout) {
      timeoutId = setTimeout(() => {
        controller.abort();
      }, timeout);
    }

    return { signal, timeoutId };
  }

  tryParseJSON = (value: any) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  };

  async formatResponse(response: Response) {
    const body = this.tryParseJSON(await response.text());

    const responseHeaders: IResponseHeaders = {};

    Array.from(response.headers.keys()).forEach((key) => {
      responseHeaders[key] = response.headers.get(key);
    });

    const formattedResponse = {
      body,
      response: {
        body,
        headers: responseHeaders,
        ok: response.ok,
        statusCode: response.status,
        statusText: response.statusText,
      },
    };

    return response.ok ? formattedResponse : { body: 'Request Error' };
  }

  async fetchOpenAPI(data: IRequest, timeout: number) {
    const abortSignal = this.configureTimeout(timeout);

    const response = await fetch(data?.url, {
      method: data?.requestMethod,
      headers: {
        'Content-Type': data?.contentType,
        ...this._input.headers,
      },
      body: JSON.stringify(data?.data),
      signal: abortSignal.signal,
    });

    clearTimeout(abortSignal.timeoutId);

    return this.formatResponse(response);
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    this._logger.log('Values: ', values);
    this._logger.log('OPENAPI Input: ', values[this.inputKey]);

    const question = values[this.inputKey];
    const schema = this._input.spec;

    const fetchSentence = RunnableSequence.from([
      {
        schema: () => schema,
        question: (input: { question: string }) => input.question,
        chat_history: () => values?.chat_history,
        format_chat_messages: () => values?.format_chat_messages,
        user_prompt: () => this._input.customizeSystemMessage || '',
      },
      this.buildPromptTemplate(this.getOpenApiPrompt()),
      this._input?.llm.bind({}),
    ]);

    const finalChain = RunnableSequence.from([
      {
        question: (input) => input.question,
        query: fetchSentence,
      },
      {
        table_info: () => schema,
        input: () => question,
        schema: () => schema,
        question: (input) => input.question,
        query: (input) => input.query,
        response: async (input) => {
          const request: IRequest = JSON.parse(
            input.query.content.replace('```json', '').replace('```', '')
          );
          return await this.fetchOpenAPI(
            request,
            this._input.timeout || 120000
          );
        },
      },
      {
        [this.outputKey]: (previousStepResult) => {
          return previousStepResult.response.body;
        },
      },
    ]);

    const result = await finalChain.invoke({ question });
    return result;
  }

  _chainType(): string {
    return 'open_api_chain' as const;
  }
}
