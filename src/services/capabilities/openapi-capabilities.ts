import { exec } from 'child_process';

import * as zod from 'zod';
import { JsonSpec } from '@langchain/classic/tools';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StructuredTool, tool } from '@langchain/core/tools';

import { ICapability } from '.';
import { IOpenAPIConfig } from '../../interface/agent.interface';

const TOOL_NAME = 'openapi-tool';
const TOOL_DESCRIPTION = `
This tool MUST be used to execute API calls based on an OpenAPI/Swagger schema.
Given a user question, it generates the appropriate curl command from the API schema and executes it.

Rules:
- ALWAYS use this tool when the user asks to interact with the API
- The tool will generate and execute the correct API call based on the schema
- DO NOT attempt to call APIs directly without using this tool

Input:
- question: a clear description of what API operation the user wants to perform

Examples:
- "List all users" → generates GET /users curl and executes it
- "Create a new product with name Test" → generates POST /products curl and executes it

Returns:
- The API response data from executing the generated curl command
`;

const TOOL_SCHEMA = zod.object({
  question: zod
    .string()
    .describe(
      'A clear description of what API operation the user wants to perform',
    ),
});

const MESSAGES = {
  apiSuccess: `The execution made for API returned successfully, this is the return data:`,
  apiError: `The execution made for API returned error, this is the return data:`,
};

class OpenAPITool implements ICapability {
  name: string;
  description: string;
  schema: zod.ZodObject<any>;

  private _settings: IOpenAPIConfig;
  private _llm: BaseLanguageModel;
  private _tool: StructuredTool;

  constructor(settings: IOpenAPIConfig, llm: BaseLanguageModel) {
    this.name = TOOL_NAME;
    this.description = TOOL_DESCRIPTION;
    this.schema = TOOL_SCHEMA;
    this._settings = settings;
    this._llm = llm;
  }

  private getOpenApiPrompt(): string {
    return `
      # You are an AI with expertise in OpenAPI and Swagger. Given the provided API schema (from SCHEMA) and the user prompt (from USER PROMPT), generate the appropriate curl command for API execution.\n
      
      ## Follow these rules to generate the curl command:\n
        1. Generate only the curl command: Output only the executable curl command, without any additional explanation or context.\n
        2. Respond only if a question is asked: Ensure that a valid question is present before attempting to generate the curl command.\n

      ## Input data:\n
        - USER PROMPT: {user_prompt}\n
        - SCHEMA: {schema}\n
        - QUESTION: {question}\n\n

      API ANSWER:
    `;
  }

  private getHeaders(): Record<string, string> | undefined {
    if (!this._settings.xApiKey && !this._settings.authorization)
      return undefined;

    const temp: Record<string, string> = {};

    if (this._settings?.xApiKey) temp['x-api-key'] = this._settings.xApiKey;

    if (this._settings?.authorization)
      temp['Authorization'] = this._settings.authorization;

    return { ...temp };
  }

  private parserCurl(curl: string): string | undefined {
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

    return undefined;
  }

  private async executeCurl(curl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(curl, (error, stdout, stderr) => {
        if (error) {
          return reject(`${MESSAGES.apiError} ${error.message}`);
        }

        return resolve(`${MESSAGES.apiSuccess} ${stdout}`);
      });
    });
  }

  private async generateCurl(question: string): Promise<string> {
    const spec = new JsonSpec(JSON.parse(this._settings.data));

    const headers = this.getHeaders();

    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(this.getOpenApiPrompt()),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ]);

    const chain = prompt.pipe(this._llm);

    const result = await chain.invoke({
      schema: JSON.stringify(spec.obj),
      question,
      headers,
      user_prompt: this._settings?.customizeSystemMessage || '',
    });

    return (result as any).content || String(result);
  }

  async func(input: any): Promise<any> {
    const { question } = input;

    const curlResponse = await this.generateCurl(question);
    const curl = this.parserCurl(curlResponse);

    if (!curl) {
      return curlResponse;
    }

    const result = await this.executeCurl(curl);
    return result;
  }

  getTool(): StructuredTool {
    if (this._tool) return this._tool;

    this._tool = tool(this.func.bind(this), {
      name: this.name,
      description: this.description,
      schema: this.schema,
    });

    return this._tool;
  }
}

export default OpenAPITool;
