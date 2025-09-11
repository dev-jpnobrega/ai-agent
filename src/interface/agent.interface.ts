import { StructuredToolInterface } from '@langchain/core/tools';
import EventEmitter from 'events';
import { DataSource } from 'typeorm';

export type MONITOR_TYPE =
  | 'langchain-smith'
  | 'smith-shared'
  | 'aws-cloudwatch'
  | 'google-stackdriver';
export type LLM_TYPE = 'azure' | 'gpt' | 'aws' | 'google';
export type DATABASE_TYPE = 'cosmos' | 'redis' | 'postgres';
export type VECTOR_SERVICE_TYPE = 'aoss' | 'es';
type HttpServer = {
  url: string;
  headers?: { [key: string]: string };
  automaticSSEFallback?: boolean;
  reconnect?: {
    enabled?: boolean;
    maxAttempts?: number;
    delayMs?: number;
  };
};
type StdioServer = {
  transport: 'stdio';
  command: string;
  args: string[];
  restart?: {
    enabled: boolean;
    maxAttempts: number;
    delayMs: number;
  };
};

export const SYSTEM_MESSAGE_DEFAULT = `
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
  maxResult?: number;
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

export interface IMCPServerConfig {
  customizeSystemMessage?: string;
  throwOnLoadError?: boolean;
  prefixToolNameWithServerName?: boolean;
  useStandardContentBlocks?: boolean;
  additionalToolNamePrefix?: string;
  mcpServers: {
    [serverName: string]: StdioServer | HttpServer;
  };
}

export interface IVectorStoreConfig {
  name: string;
  type: LLM_TYPE;
  apiKey: string;
  user?: string;
  pass?: string;
  apiVersion: string;
  indexes: string[] | string;
  vectorFieldName: string;
  model?: string;
  customFilters?: string;
  top?: number;
  region?: string;
  serviceType?: VECTOR_SERVICE_TYPE;
  vectorSearch?: boolean;
}

/**
 * Configuration interface for a monitor.
 *
 * @interface IMonitorConfig
 * @property {MONITOR_TYPE} type - The type of the monitor.
 * @property {string} apiKey - The API key used for authentication.
 * @property {string} projectName - The name of the project being monitored.
 * @property {string} endpoint - The endpoint URL for the monitor.
 */
export interface IMonitorConfig {
  type: MONITOR_TYPE;
  apiKey: string;
  projectName: string;
  endpoint: string;
}

/**
 * Configuration interface for an agent.
 *
 * @property {string} [name] - Optional name of the agent.
 * @property {boolean} [debug] - Optional flag to enable debug mode.
 * @property {string} [systemMessage] - Optional system message for the agent.
 * @property {ILLMConfig} llmConfig - Configuration for the language model.
 * @property {IChatConfig} chatConfig - Configuration for the chat settings.
 * @property {IDatabaseConfig} [dbHistoryConfig] - Optional configuration for database history.
 * @property {IVectorStoreConfig} [vectorStoreConfig] - Optional configuration for vector store.
 * @property {IDataSourceConfig} [dataSourceConfig] - Optional configuration for data source.
 * @property {IMcpServerConfig} [mcpServerConfig] - Optional configuration for mcp servers.
 * @property {IOpenAPIConfig} [openAPIConfig] - Optional configuration for OpenAPI.
 * @property {IMonitorConfig} [monitor] - Optional configuration for monitoring.
 */
export interface IAgentConfig {
  name?: string;
  debug?: boolean;
  systemMessage?: string;
  llmConfig: ILLMConfig;
  chatConfig: IChatConfig;
  dbHistoryConfig?: IDatabaseConfig;
  vectorStoreConfig?: IVectorStoreConfig;
  dataSourceConfig?: IDataSourceConfig;
  openAPIConfig?: IOpenAPIConfig;
  mcpServerConfig?: IMCPServerConfig;
  monitor?: IMonitorConfig;
}

export interface IAgentExecutor {
  name?: string;
  debug?: boolean;
  systemMessage?: string;
  llmConfig: ILLMConfig;
  chatConfig: IChatConfig;
  dbHistoryConfig?: IDatabaseConfig;
  monitor?: IMonitorConfig;
  tools?: StructuredToolInterface[];
  mcpServerConfig?: IMCPServerConfig;
  handleToolRuntimeErrors?: (error: Error) => string;
}

/**
 * Interface representing the input properties for an agent.
 */
export interface IInputProps {
  /**
   * The question to be asked.
   * @optional
   */
  question?: string;

  /**
   * The user session identifier.
   * @optional
   */
  userSessionId?: string;

  /**
   * The chat thread identifier.
   * @optional
   */
  chatThreadID?: string;

  /**
   * The context in which the question is asked.
   * @optional
   */
  context?: string;

  /**
   * Flag indicating whether the response should be streamed.
   * @optional
   */
  stream?: boolean;
}

export interface TModel extends Record<string, unknown> {}

export interface IAgent extends EventEmitter {
  name: string;
  description?: string;
  call(input: IInputProps): Promise<void>;
}
