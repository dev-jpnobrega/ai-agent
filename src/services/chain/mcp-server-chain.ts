import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { StructuredToolInterface } from "@langchain/core/tools";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
    SystemMessagePromptTemplate
} from "@langchain/core/prompts";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";

import { IChain } from ".";
import { IMcpServerConfig } from "../../interface/agent.interface";

class McpServerChain implements IChain {
    private _settings: IMcpServerConfig;
    private _outputKey = 'mcpToolResult';

    constructor(settings: IMcpServerConfig) {
        this._settings = settings;
    }

    private getMcpPrompt(): string {
        return `
        # You are a helpful AI Assistant focused on orchestrate tools according to user question (QUESTION) and following instructions from USER PROMPT\n
        ## You should adjust the tool input request according to its schema.
        Assistant is constantly learning and improving, and its capabilities are constantly evolving.
        It is able to process and understand large amounts of text, and can use this knowledge to provide accurate and informative responses.\n\n

        ## Input data:\n
        - USER PROMPT: {user_prompt}\n
        - USER CONTEXT: {user_context}\n
        - CHAT HISTORY: {format_chat_messages}\n
        - QUESTION: {question}\n\n

        Tool Response:
        `
    }

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

    private async getServerTools(): Promise<StructuredToolInterface[]> {
        let tools;
        const { mcpServers } = this._settings;

        const client = new MultiServerMCPClient({
            prefixToolNameWithServerName: false,
            useStandardContentBlocks: true,
            mcpServers
        });

        try {
            tools = await client.getTools();
        }
        catch (error) {
            console.log(error);
            throw error;
        }

        return tools;
    }

    public async create(
        llm: BaseLanguageModel,
        ...args: any
    ): Promise<RunnableSequence<any, any>> {
        const tools = await this.getServerTools();

        const prompt = this.buildPromptTemplate(this.getMcpPrompt());

        const agent = createToolCallingAgent({ llm, tools, prompt });

        const agentExecutor = new AgentExecutor({
            agent,
            tools,
            verbose: true, //debug mode
            handleToolRuntimeErrors: (error) => {
                return error.message;
            },
        });

        const mcpChain = RunnableSequence.from([
            RunnablePassthrough.assign({
                user_prompt: (input: any) => this._settings?.customizeSystemMessage,
            }),
            agentExecutor,
            RunnablePassthrough.assign({
                [this._outputKey]: (previousStepResult: any) => {
                    return previousStepResult?.output;
                },
            })
        ]);

        return mcpChain;
    }
}
export default McpServerChain;