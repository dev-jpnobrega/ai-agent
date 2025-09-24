import { exec } from 'child_process';

import { JsonSpec } from 'langchain/tools';
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

import { IOpenAPIConfig } from '../../interface/agent.interface';
import { IChain } from '.';

const MESSAGES = {
  apiSuccess: `The execution made for API returned successfully, this is the return data:`,
  apiError: `The execution made for API returned error, this is the return data:`,
};

class OpenAPIChain implements IChain {
  private _settings: IOpenAPIConfig;
  private _outputKey = 'openAPIResult';

  constructor(settings: IOpenAPIConfig) {
    this._settings = settings;
  }

  private getOpenApiPrompt(): string {
    return `
      # You are an AI with expertise in OpenAPI and Swagger. Given the provided API schema (from SCHEMA) and the user prompt (from USER PROMPT), generate the appropriate curl command for API execution.\n
      
      ## Follow these rules to generate the curl command:\n
        1. Generate only the curl command: Output only the executable curl command, without any additional explanation or context.\n
        2. Ensure that break line should ends with a single backslash\n
        3. Avoid duplicate requests:\n
          - If the same question has already been answered in CHAT HISTORY and result is success, use the previous answer and do not generate a new request.\n
          - Only generate the request if the question is new.\n
        4. Respond only if a question is asked: Ensure that a valid question is present before attempting to generate the curl command.\n

      ## Input data:\n
        - USER PROMPT: {user_prompt}\n
        - USER CONTEXT: {user_context}\n
        - SCHEMA: {schema}\n
        - CHAT HISTORY: {format_chat_messages}\n
        - QUESTION: {question}\n\n

      API ANSWER:
    `;
  }

  private buildPromptTemplate(systemMessages: string): BasePromptTemplate {
    const combine_messages = [
      SystemMessagePromptTemplate.fromTemplate(systemMessages),
      new MessagesPlaceholder('history'),
      AIMessagePromptTemplate.fromTemplate('Wait! We are searching our API.'),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ];

    const CHAT_COMBINE_PROMPT =
      ChatPromptTemplate.fromMessages(combine_messages);

    return CHAT_COMBINE_PROMPT;
  }

  private getHeaders(): Record<string, string> | undefined {
    if (!this._settings.xApiKey && !this._settings.authorization)
      return undefined;

    const temp: any = {};

    if (this._settings?.xApiKey) temp['x-api-key'] = this._settings.xApiKey;

    if (this._settings?.authorization)
      temp['Authorization'] = this._settings.authorization;

    return { ...temp };
  }

  parserCurl(curl: string) {
    const curlL = curl;

    if (curlL.startsWith('CURL') || curlL.startsWith('curl')) {
      return curlL;
    }

    if (curlL.includes('```bash')) {
      const regex = /```(.*?)```/gs;
      const matches = [...curlL.matchAll(regex)];
      const curlBlocks = matches.map((match) => match[1]);

      let curlCommand = curlBlocks[0].replace('bash', '');

      return curlCommand.replace('\n', '').replace('\n', '');
    }

    if (curlL.includes('```sh')) {
      const regex = /```(.*?)```/gs;
      const matches = [...curlL.matchAll(regex)];
      const curlBlocks = matches.map((match) => match[1]);

      let curlCommand = curlBlocks[0].replace('sh', '');

      return curlCommand.replace('\n', '').replace('\n', '');
    }
    return;
  }

  private async executeOpenAPI(input: any) {
    return new Promise((resolve, reject) => {
      try {
        const curl = this.parserCurl(input?.curl?.content);

        if (!curl) return resolve(input?.curl?.content);

        exec(curl, (error, stdout, stderr) => {
          if (error) {
            return reject(error);
          }

          return resolve(`${MESSAGES.apiSuccess} ${stdout}`);
        });
      } catch (error) {
        return reject(error);
      }
    });
  }

  private async buildCurlChain(
    spec: JsonSpec,
    llm: BaseLanguageModel
  ): Promise<RunnableSequence<any, any>> {
    const prompt = this.buildPromptTemplate(this.getOpenApiPrompt());

    const openAPICurlChain = RunnableSequence.from([
      {
        schema: () => spec.obj,
        chat_thread_id: (input: any) => input.chat_thread_id,
        question: (input) => input.question,
        user_prompt: (input) => this._settings?.customizeSystemMessage,
        user_context: (input) => input.user_context,
        history: (input) => input.history,
        format_chat_messages: (input) => input.format_chat_messages,
      },
      prompt,
      llm.withConfig({ stop: ['\nAPI ANSWER:'] }),
    ]);

    return openAPICurlChain;
  }

  public async create(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any>> {
    const spec = new JsonSpec(JSON.parse(this._settings.data));

    const openAPIChain = RunnableSequence.from([
      {
        schema: () => spec.obj,
        chat_thread_id: (input: any) => input.chat_thread_id,
        user_prompt: () => this._settings?.customizeSystemMessage,
        user_context: (input: any) => input.user_context,
        history: (input: any) => input.history,
        question: (input: any) => input.question,
        format_chat_messages: (input) => input.format_chat_messages,
        curl: await this.buildCurlChain(spec, llm),
      },
      {
        schema: () => spec.obj,
        chat_thread_id: (input: any) => input.chat_thread_id,
        user_prompt: () => this._settings?.customizeSystemMessage,
        user_context: (input: any) => input.user_context,
        history: (input: any) => input.history,
        question: (input: any) => input.question,
        format_chat_messages: (input) => input.format_chat_messages,
        response: this.executeOpenAPI.bind(this),
      },
      {
        [this._outputKey]: (previousStepResult: any) => {
          return previousStepResult?.response;
        },
      },
    ]);

    return RunnableSequence.from([
      RunnablePassthrough.assign({
        openAPIChain,
      }),
      RunnablePassthrough.assign({
        [this._outputKey]: (input: { openAPIChain: any }) =>
          input.openAPIChain[this._outputKey],
      }),
    ]);
  }
}

export default OpenAPIChain;
