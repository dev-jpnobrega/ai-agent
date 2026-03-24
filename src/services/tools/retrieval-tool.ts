import * as zod from 'zod';
import { ITool } from '.';
import { VectorStore } from '@langchain/core/vectorstores';
import { StructuredTool, tool } from '@langchain/core/tools';

const TOOL_NAME = 'retrieval-tool';
const TOOL_DESCRIPTION = `
MANDATORY TOOL.

This tool MUST be used to retrieve relevant documents from the vector database 
for ANY user question that requires factual, technical, or domain-specific information.

Rules:
- ALWAYS call this tool before answering any question related to knowledge, documentation, or product behavior
- DO NOT answer from your own knowledge without using this tool first
- The final answer MUST be grounded in the retrieved documents

Input:
- query: a concise and well-structured semantic search query derived from the user's request

Query guidelines:
- Extract the core intent of the user question
- Use keywords instead of full sentences
- Remove unnecessary words

Examples:
- "How does payment retry work?" → "payment retry logic"
- "Erro ao criar pedido" → "order creation error handling"

Returns:
- Relevant documents or text snippets that MUST be used to construct the answer

Only skip this tool if:
- The user input is purely conversational (e.g., greetings)
`;

const TOOL_SCHEMA = zod.object({
  query: zod
    .string()
    .describe('A concise semantic search query derived from the users request'),
});

class RetrievalTool implements ITool {
  name: string;
  description: string;
  schema: zod.ZodObject<any>;

  private _vectorStore: VectorStore;
  private _tool: StructuredTool;

  constructor(vectorStore: VectorStore) {
    this.name = TOOL_NAME;
    this.description = TOOL_DESCRIPTION;
    this.schema = TOOL_SCHEMA;
    this._vectorStore = vectorStore;
  }

  async func(input: any): Promise<any> {
    const { query } = input;
    const docs = await this._vectorStore.similaritySearch(query, 5);

    return Promise.resolve(docs.map((doc) => doc.pageContent).join('\n---\n'));
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

export default RetrievalTool;
