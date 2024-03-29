import { DataSource } from 'typeorm';

export type LLM_TYPE = 'azure' | 'gpt' | 'aws' | 'google';
export type DATABASE_TYPE = 'cosmos' | 'redis' | 'postgres';

export const SYSTEM_MESSAGE_DEFAULT = `
  You are a helpful AI assistant.
  Solve tasks using your coding and language skills.
  In the following cases, suggest python code (in a python coding block) or shell script (in a sh coding block) or javascript (in a javascript coding block) for the user to execute.
      1. When you need to collect info, use the code to output the info you need, for example, browse or search the web, download/read a file, print the content of a webpage or a file, get the current date/time, check the operating system. After sufficient info is printed and the task is ready to be solved based on your language skill, you can solve the task by yourself.
      2. When you need to perform some task with code, use the code to perform the task and output the result. Finish the task smartly.
  Solve the task step by step if you need to. If a plan is not provided, explain your plan first. Be clear which step uses code, and which step uses your language skill.
  When using code, you must indicate the script type in the code block. The user cannot provide any other feedback or perform any other action beyond executing the code you suggest. The user can't modify your code. So do not suggest incomplete code which requires users to modify. Don't use a code block if it's not intended to be executed by the user.
  If you want the user to save the code in a file before executing it, put # filename: <filename> inside the code block as the first line. Don't include multiple code blocks in one response. Do not ask users to copy and paste the result. Instead, use 'print' function for the output when relevant. Check the execution result returned by the user.
  If the result indicates there is an error, fix the error and output the code again. Suggest the full code instead of partial code or code changes. If the error can't be fixed or if the task is not solved even after the code is executed successfully, analyze the problem, revisit your assumption, collect additional info you need, and think of a different approach to try.
  When you find an answer, verify the answer carefully. Include verifiable evidence in your response if possible.
  Reply "TERMINATE" in the end when everything is done.
`;

export interface IDatabaseConfig {
  type: DATABASE_TYPE;
  host: string;
  port: number;
  ssl?: boolean;
  sessionId?: string;
  sessionTTL?: number;
  username?: string;
  password?: string;
  database?: string | number;
  container?: string;
  synchronize?: boolean;
  limit?: number;
}

export interface IDataSourceConfig {
  dataSource: DataSource;
  includesTables?: string[];
  ignoreTables?: string[];
  customizeSystemMessage?: string;
  ssl?: boolean;
}

export interface IOpenAPIConfig {
  data: string;
  customizeSystemMessage?: string;
  xApiKey?: string;
  authorization?: string;
}

export interface IChatConfig {
  temperature: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  maxTokens?: number;
}

export interface ILLMConfig {
  type: LLM_TYPE;
  model: string;
  instance?: string;
  apiKey: string;
  apiVersion: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
}

export interface IVectorStoreConfig {
  name: string;
  type: LLM_TYPE;
  apiKey: string;
  apiVersion: string;
  indexes: string[] | string;
  vectorFieldName: string;
  model?: string;
  customFilters?: string;
}

export interface IAgentConfig {
  name?: string;
  debug?: boolean;
  systemMesssage?: string | typeof SYSTEM_MESSAGE_DEFAULT;
  llmConfig: ILLMConfig;
  chatConfig: IChatConfig;
  dbHistoryConfig?: IDatabaseConfig;
  vectorStoreConfig?: IVectorStoreConfig;
  dataSourceConfig?: IDataSourceConfig;
  openAPIConfig?: IOpenAPIConfig;
}

export interface IInputProps {
  question?: string;
  userSessionId?: string;
  chatThreadID?: string;
}

export interface TModel extends Record<string, unknown> {}

export interface IAgent {
  call(input: IInputProps): Promise<void>;

  emit(event: string, ...args: any[]): void;

  on(eventName: string | symbol, listener: (...args: any[]) => void): this;
}
