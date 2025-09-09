import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { Document } from 'langchain/document';
import { v4 as uuid } from 'uuid';

import {
  IAgent,
  IAgentConfig,
  IInputProps,
  TModel,
} from './interface/agent.interface';

import AgentBase from './agent.base';

import EVENTS_NAME from './helpers/events.name';
import { ChainService, IChainService } from './services/chain';
import LLMFactory from './services/llm';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import VectorStoreFactory from './services/vector-store';

/**
 * Represents an Agent that extends the AgentBaseCommand and implements the IAgent interface.
 * This class is responsible for handling the setup and execution of language model interactions,
 * managing chat history, and emitting events based on the interactions.
 */
class Agent extends AgentBase implements IAgent {
  /**
   * The language model used by the agent.
   */
  private _llm: BaseLanguageModel;

  /**
   * The service responsible for building chains of interactions.
   */
  private _chainService: IChainService;

  /**
   * Creates an instance of the Agent class.
   * @param settings - The configuration settings for the agent.
   */
  constructor(settings: IAgentConfig) {
    super(settings);
    this.setup(settings);
  }

  /**
   * Sets up the agent with the provided settings.
   * @param settings - The configuration settings for the agent.
   */
  private setup(settings: IAgentConfig): void {
    this._name = settings?.name || 'AssistentAgent';
    this._llm = LLMFactory.create(settings.chatConfig, settings.llmConfig);
    this._chainService = new ChainService(settings);
  }

  /**
   * Streams data from a given chain and emits events for each chunk of data received.
   *
   * @param chain - The runnable chain that processes the input and returns a stream of data.
   * @param input - The input data to be processed by the chain.
   * @returns A promise that resolves to the concatenated string of all chunks received from the stream.
   *
   * @emits EVENTS_NAME.onToken - Emitted for each chunk of data received from the stream.
   */
  private async stream(
    chain: RunnableWithMessageHistory<any, any>,
    input: any,
    runId: string
  ): Promise<string> {
    const stream = await chain.stream(input, {
      runId,
      runName: this._name,
      configurable: { sessionId: input?.chatThreadID || uuid() },
    });

    let finalMessage: string[] = [];
    for await (const chunk of stream) {
      finalMessage.push(chunk);

      this.emit(EVENTS_NAME.onToken, chunk);
    }

    return ''.concat(...finalMessage);
  }

  /**
   * Calls the agent with the provided input properties.
   * @param args - The input properties for the agent call.
   * @returns A promise that resolves when the call is complete.
   *
   * @emits EVENTS_NAME.onMessage - Emitted with the concatenated final message once the stream is complete.
   * @emits EVENTS_NAME.onToken - If stream enable, emitted for each chunk of data received from the stream.
   * @emits EVENTS_NAME.onEnd - Emitted when the streaming process is terminated.
   */
  async call(args: IInputProps): Promise<void> {
    const runId = uuid();

    try {
      const chatHistory = await this.buildHistory(
        args?.chatThreadID,
        this._settings.dbHistoryConfig
      );

      const chain = await this._chainService.build(
        this._llm,
        args?.question,
        chatHistory.getChatHistory(),
        args?.context,
        runId,
        this._name
      );

      const chatMessages = await chatHistory.getMessages();

      const input: any = {
        question: args?.question,
        chat_thread_id: args?.chatThreadID,
        user_name: args?.userSessionId,
        user_context: args?.context,
        user_prompt: this._settings?.systemMesssage,
        history: chatMessages,
        format_chat_messages: await chatHistory.getFormatedMessages(
          chatMessages
        ),
      };

      let result = '';

      if (args?.stream) {
        result = await this.stream(chain, input, runId);
      } else {
        result = await chain.invoke(input, {
          runName: this._name,
          runId,
          configurable: { sessionId: args?.chatThreadID || uuid() },
        });
      }

      this.emit(EVENTS_NAME.onMessage, result);
      this.emit(EVENTS_NAME.onEnd, 'terminated');
    } catch (error) {
      this._logger.error(error);
      this.emit(EVENTS_NAME.onError, error);
    } finally {
      return;
    }
  }

  async tranning(documents: Document<TModel>[]) {
    const service = VectorStoreFactory.create(
      this._settings.vectorStoreConfig,
      this._settings.llmConfig
    );

    await service.addDocuments(documents);
  }

  /**
   * Executes the agent with the provided arguments.
   * @param args - The arguments for the agent execution.
   * @returns A promise that resolves when the execution is complete.
   * @throws An error with the provided arguments.
   */
  execute(args: any): Promise<void> {
    throw new Error(args);
  }
}

export default Agent;
