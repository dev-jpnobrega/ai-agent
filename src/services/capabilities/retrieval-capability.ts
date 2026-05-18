import * as zod from 'zod';
import { ICapability } from '.';
import { VectorStore } from '@langchain/core/vectorstores';
import { StructuredTool, tool } from '@langchain/core/tools';
import { DocumentInterface } from '@langchain/core/documents';

const TOOL_NAME = 'retrieval-tool';
const TOOL_DESCRIPTION = `
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
  top: zod
    .number()
    .optional()
    .describe('The number (Optional) of relevant documents to retrieve'),
});

class RetrievalCapability implements ICapability {
  name: string;
  description: string;
  schema: zod.ZodObject<any>;

  private _vectorStore: VectorStore;
  private _tool?: StructuredTool;

  constructor(vectorStore: VectorStore) {
    this.name = TOOL_NAME;
    this.description = TOOL_DESCRIPTION;
    this.schema = TOOL_SCHEMA;
    this._vectorStore = vectorStore;
  }

  private formatResult(
    docs: DocumentInterface[],
  ): [string, DocumentInterface[]] {
    const formatDoc = (doc: DocumentInterface): string => `
      Document ID: ${doc.metadata?.id || 'N/A'}\n
      Snippet:
      ${doc.pageContent}

      \n\nMetadata:
      ${JSON.stringify(doc.metadata, null, 2)}
    `;

    const formattedDocs = docs.map(formatDoc).join('\n\n---\n');

    return [formattedDocs, docs];
  }

  async func(input: any): Promise<any> {
    const { query, top } = input;
    const docs = await this._vectorStore.similaritySearch(query, top);

    return Promise.resolve(this.formatResult(docs));
  }

  getTool(): StructuredTool {
    if (this._tool) return this._tool;

    this._tool = tool(this.func.bind(this), {
      name: this.name,
      description: this.description,
      schema: this.schema,
      responseFormat: 'content_and_artifact',
    });

    return this._tool;
  }
}

export default RetrievalCapability;
