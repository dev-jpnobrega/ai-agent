import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { v4 as uuid } from 'uuid';

import AgentBase from './agent.base';

import {
  IAgent,
  IAgentSupervisor,
  IInputProps,
  IMCPServerConfig,
} from './interface/agent.interface';

import EVENTS_NAME from './helpers/events.name';
import { IChainService, ChainService } from './services/chain';
import MCPChain from './services/chain/mcp-client-chain';
import LLMFactory from './services/llm';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import {
  AgentExecutor as AgentExecutorLangchain,
  createToolCallingAgent,
} from 'langchain/agents';
import { StructuredToolInterface, tool } from '@langchain/core/tools';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { BaseListChatMessageHistory } from '@langchain/core/chat_history';

class AgentSupervisor extends AgentBase implements IAgent {
  /**
   * The language model used by the agent.
   */
  private _llm: BaseLanguageModel;

  /**
   * The service responsible for building chains of interactions.
   */
  private _chainService: IChainService;

  private _settingsAgent: IAgentSupervisor;

  /**
   * Instance of the AgentExecutorLangchain responsible for executing agent tasks.
   * Used internally to manage and run agent operations within the executor.
   */
  private _agentExecutor: AgentExecutorLangchain;

  /**
   * An array of tools that implement the StructuredToolInterface.
   * These tools are used internally by the agent executor to perform specific actions or operations.
   *
   * @private
   */
  private _tools: StructuredToolInterface[];

  /**
   * Creates an instance of the Agent class.
   * @param settings - The configuration settings for the agent.
   */
  constructor(settings: IAgentSupervisor) {
    super(settings);

    this._settingsAgent = settings;
    this.setup(settings);
  }

  /**
   * Sets up the agent with the provided settings.
   * @param settings - The configuration settings for the agent.
   */
  private setup(settings: IAgentSupervisor): void {
    this.name = settings?.name || 'AssistentAgentSupervisor';
    this._llm = LLMFactory.create(settings.chatConfig, settings.llmConfig);
  }

  /**
   * Constructs a system message template for agent responses, outlining guidelines and input data.
   * The template includes placeholders for user rules, user context, and the question.
   *
   * @returns {string} The formatted system message template with embedded instructions and input placeholders.
   */
  private buildSystemMessages(): string {
    let builtMessage = '';
    builtMessage += `
      # Supervisor Agent (Tools-Oriented, Natural Output)\n\n

      ## Primary Role\n
      You are the **Supervisor Agent**.\n  
      Your responsibility is to analyze the user’s request, determine the relevant domain(s), and **invoke one or more specialized tools** (agents) to gather the necessary information or actions.\n\n

      Each specialized Agent is represented as a **tool** that you can call.\n
      You should never answer entirely by yourself:\n
      - Instead, you **select and invoke the appropriate tool(s)**.\n
      - After receiving the tool responses, you **combine and summarize them into a single, clear, and natural language response** for the user.\n
      - Always wait for all tools to respond before generating the final response.\n\n  

      ---\n\n

      ## Input Data\n
      - **USER RULES**: {user_prompt}\n
      - **USER CONTEXT**: {user_context}\n\n

      ---\n\n

      ## Response Guidelines\n
      1. **Prioritize User Rules and User Context** if available.\n
      2. **Do not fabricate information**:\n
        - Use only what is explicitly given in USER RULES and USER CONTEXT.\n
        - If data is missing, politely inform the user or request clarification.\n
      3. **Ignore irrelevant history** not tied to the current query.\n 
      4. **Only process if the user asks a clear question**.\n
      5. **Always ensure accuracy and timeliness**.\n 
      6. **Final responses must always be written in natural, human-readable language**, never raw JSON.\n
      7. It is **IMPORTANT** to always include the Agents used to generate the final answer in your response, presenting the perspective of each Agent used on the question.\n\n

      ---\n\n

      ## Supervisor Behavior\n
      1. **Analyze the user request** to identify intent(s).  \n
      2. **Select one or multiple tools** if the query spans more than one domain. \n 
      3. **Send the relevant question or data to each tool**.  \n
      4. **Wait for tool outputs**.  \n
      5. **Synthesize the responses into one unified answer in natural language**, making it clear, concise, and easy to understand.  \n
      6. **If ambiguous**, ask for clarification instead of guessing.  \n\n

      ---\n\n

      ## Available Tools\n
        {available_tools}\n\n
      - **code_agent** → Technical requests: programming, testing, code quality.  
      - **product_agent** → PRD, business opportunities, requirements, metrics.  
      - **payments_agent** → Payment integrations, financial workflows.  
      - **promotions_agent** → Eligibility rules, incentives, campaigns.  
      - **ai900_agent** → Study support, summaries, exercises, AI-900 certification.  
      - **profile_agent** → LinkedIn/profile evaluation, professional summaries.  

      --- \n\n

      ## Output Format\n
      - **Do not return JSON to the user**.\n
      - **Always return a final, natural language response**, integrating the outputs of the selected tools.  \n
      - Mention clearly which aspects were handled by which tool if relevant. \n 

      ---\n\n

      ### Example 1\n
      **User:** "I want to create the PRD and the code for the following opportunity" \n\n

      **Supervisor Agent (final response):**  \n
      "I have prepared the PRD describing the business opportunity, including its objectives, requirements, and expected impact (from the Product Agent).  \n
      Based on this PRD, I also generated the corresponding code implementation to bring it to life (from the Code Agent)."  \n

      ---\n\n

      ### Example 2\n
      **User:** "I want to integrate payments and apply a promotional campaign" \n\n

      **Supervisor Agent (final response):** \n
      "Heres the combined plan: the Payments Agent provided the steps and APIs needed to integrate the payment flow, while the Promotions Agent outlined how to apply a promotional campaign on top of it. Together, this ensures both the financial process and the promotional rules work seamlessly.\n"
    `;

    builtMessage += `
      User Question:\n
      - {question}\n
    `;

    return builtMessage;
  }

  /**
   * Builds a chat prompt template for agent execution.
   *
   * The template consists of:
   * - A system message (provided as a parameter)
   * - A placeholder for conversation history
   * - A placeholder for the agent's scratchpad (intermediate steps)
   * - A human message containing the user's question
   *
   * @param systemMessages - The system message(s) to include in the prompt template.
   * @returns A `ChatPromptTemplate` composed of the specified messages and placeholders.
   */
  private buildPromptTemplate(systemMessages: string): ChatPromptTemplate {
    const combine_messages = [
      SystemMessagePromptTemplate.fromTemplate(systemMessages),
      new MessagesPlaceholder('history'),
      new MessagesPlaceholder('agent_scratchpad'),
      HumanMessagePromptTemplate.fromTemplate('{question}'),
    ];
    const CHAT_COMBINE_PROMPT =
      ChatPromptTemplate.fromMessages(combine_messages);

    return CHAT_COMBINE_PROMPT;
  }

  /**
   * Executes the agent's call method with the provided question and returns a promise
   * that resolves when the agent emits an onMessage event or rejects when an onError event occurs.
   *
   * @param agent - The agent instance implementing the IAgent interface.
   * @param question - The question string to be sent to the agent.
   * @returns A Promise that resolves with the message emitted by the agent or rejects with an error.
   */
  private async executeWithPromise(
    agent: IAgent,
    input: IInputProps
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      agent.on(EVENTS_NAME.onError, (error) => {
        return reject(error);
      });
      agent.on(EVENTS_NAME.onMessage, (message) => {
        return resolve(message);
      });

      (async () => {
        await agent.call({ ...input });
      })();
    });
  }

  /**
   * Creates a structured tool instance for a given agent.
   *
   * This method generates a tool with a unique name based on the agent's name,
   * replacing spaces, hyphens, and parentheses with underscores. The tool is configured
   * to accept a single `question` property, which is passed to the agent for execution.
   *
   * @param agent - The agent for which the tool is being created. Must implement the `IAgent` interface.
   * @returns A `StructuredToolInterface` instance configured for the specified agent.
   */
  private createToolByAgent(agent: IAgent): StructuredToolInterface {
    const toolName = `${agent.name
      .toLowerCase()
      .replaceAll(' ', '_')
      .replaceAll(`-`, '_')
      .replaceAll(`(`, '_')
      .replaceAll(`)`, '_')}_tool`;

    const toolBuilder = tool(
      async (params, config) => {
        const response = await this.executeWithPromise(agent, params);
        return response;
      },
      {
        name: toolName,
        description: agent?.description,
        schema: Object({
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: `The user's question to be answered by the ${agent.name} agent.`,
            },
            chatThreadID: {
              type: 'string',
              description: `(Optional) The chat thread ID for the conversation.`,
            },
            userSessionId: {
              type: 'string',
              description: `(Optional) The user session ID for the conversation.`,
            },
            context: {
              type: 'string',
              description: `(Optional) Additional context for the agent to consider when answering the question.`,
            },
          },
          required: ['question'],
        }),
      }
    );

    return toolBuilder;
  }

  /**
   * Builds and returns an array of structured tool interfaces based on the provided agents.
   * If the tools have already been built and cached, returns the cached tools.
   *
   * @param agents - An array of agent instances to create tools from.
   * @returns A promise that resolves to an array of `StructuredToolInterface` objects.
   */
  private async buildTools(
    agents: IAgent[]
  ): Promise<StructuredToolInterface[]> {
    if (this._tools && this._tools.length > 0) return this._tools;

    this._tools = agents.map((agent) => this.createToolByAgent(agent));

    return this._tools;
  }

  /**
   * Builds and returns an instance of {@link AgentExecutorLangchain} for managing agent execution.
   *
   * If an executor instance already exists, it returns the cached instance.
   * Otherwise, it initializes the required tools, constructs the prompt template,
   * creates the agent, and sets up the executor with error handling and verbosity options.
   *
   * @returns {Promise<AgentExecutorLangchain>} A promise that resolves to the agent executor instance.
   */
  private async buildAgentExecutor(): Promise<AgentExecutorLangchain> {
    if (this._agentExecutor) return this._agentExecutor;

    const tools = await this.buildTools(this._settingsAgent.agents);

    const prompt = this.buildPromptTemplate(this.buildSystemMessages());

    const agent = createToolCallingAgent({ llm: this._llm, tools, prompt });

    this._agentExecutor = new AgentExecutorLangchain({
      agent,
      tools,
      verbose: this._settingsAgent?.debug ?? true,
      handleToolRuntimeErrors: (error: Error) => {
        if (this._settingsAgent.handleToolRuntimeErrors) {
          this._settingsAgent.handleToolRuntimeErrors(error);
        }

        this._logger.error(error);

        return error.message;
      },
    });

    return this._agentExecutor;
  }

  /**
   * Builds a runnable chain with message history for the agent.
   *
   * This method initializes the agent executor and ensures that the chain service is available.
   * It then constructs a runnable chain using the provided chat history and returns it.
   *
   * @param chatHistory - The chat message history to be used in the chain.
   * @returns A promise that resolves to a runnable chain with message history.
   */
  private async buildChain(
    chatHistory: BaseListChatMessageHistory
  ): Promise<RunnableWithMessageHistory<any, any>> {
    const agentExecutor = await this.buildAgentExecutor();

    if (!this._chainService) {
      this._chainService = new ChainService(this._settingsAgent);
    }

    const chain = await this._chainService.buildRunnableWithMessageHistory(
      agentExecutor,
      chatHistory as unknown as BaseListChatMessageHistory
    );

    return chain;
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
      runName: this.name,
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
        this._settingsAgent.dbHistoryConfig
      );

      const chain = await this.buildChain(
        chatHistory as unknown as BaseListChatMessageHistory
      );

      const chatMessages = await chatHistory.getMessages();

      const input: any = {
        question: args?.question,
        chat_thread_id: args?.chatThreadID,
        user_name: args?.userSessionId,
        user_context: args?.context,
        user_prompt: this._settingsAgent?.systemMessage,
        available_tools: this._tools.map(
          (tool) => `- **${tool.name}** → ${tool.description}`
        ),
        history: chatMessages,
        format_chat_messages: await chatHistory.getFormatedMessages(
          chatMessages
        ),
      };

      let result: any = '';

      if (args?.stream) {
        result = await this.stream(chain, input, runId);
      } else {
        result = await chain.invoke(input, {
          runName: this.name,
          runId,
          configurable: { sessionId: args?.chatThreadID || uuid() },
        });
      }

      this.emit(EVENTS_NAME.onMessage, result?.output ?? result);
      this.emit(EVENTS_NAME.onEnd, 'terminated');
    } catch (error) {
      this._logger.error(error);
      this.emit(EVENTS_NAME.onError, error);
    } finally {
      return;
    }
  }

  /**
   * Retrieves the list of structured tools managed by the agent supervisor.
   *
   * @returns {StructuredToolInterface[]} An array of structured tool interfaces currently available.
   */
  getTools(): StructuredToolInterface[] {
    return this._tools;
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

export default AgentSupervisor;
