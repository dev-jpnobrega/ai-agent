import { CallbackManagerForChainRun } from "langchain/callbacks";
import { BaseChain, createOpenAPIChain } from "langchain/chains";
import { BaseChatModel } from "langchain/chat_models/base";
import { BaseFunctionCallOptions } from "langchain/dist/base_language";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "langchain/prompts";
import { ChainValues } from "langchain/schema";
import type { OpenAPIV3_1 } from "openapi-types";

export type OpenApiBaseChainInput = {
    spec: string | OpenAPIV3_1.Document<{}>;
    llm?: BaseChatModel<BaseFunctionCallOptions>;
    customMessage?: string;
    headers: Record<string, string>;
};

export class OpenApiBaseChain extends BaseChain {
    readonly inputKey = "query";
    readonly outputKey = "openAPIResult";
    private input: OpenApiBaseChainInput;

    constructor(input: OpenApiBaseChainInput) {
        super();
        this.input = input;
    }

    get inputKeys(): string[] {
        return [this.inputKey];
    }

    get outputKeys(): string[] {
        return [this.outputKey];
    }

    private getOpenApiPrompt(): ChatPromptTemplate {
        const prompt = `You are an AI with expertise in OpenApi and Swagger.
Always answer the question in the language in which the question was asked.
- Always respond with the URL;
- Never put information or explanations in the answer;
${this.input.customMessage || ''}`;
        return ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(prompt),
            HumanMessagePromptTemplate.fromTemplate('{question}'),
        ]);
    }

    async _call(values: ChainValues, runManager?: CallbackManagerForChainRun): Promise<ChainValues> {
        const question = values[this.inputKey];
        const chain = await createOpenAPIChain(this.input.spec, {
            llm: this.input.llm,
            prompt: this.getOpenApiPrompt(),
            headers: this.input.headers
        });
        const answer = await chain.invoke({ question });

        console.log("OPENAPI Resposta: ", answer);

        return { [this.outputKey]: answer };
    }

    _chainType(): string {
        return "open_api_chain" as const;
    }
}