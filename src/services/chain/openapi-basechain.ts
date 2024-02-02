import { CallbackManagerForChainRun } from "langchain/callbacks";
import { BaseChain, OpenAPIChainOptions, SequentialChain, createOpenAPIChain } from "langchain/chains";
import { ChainValues } from "langchain/schema";



export default class OpenAPIBaseChain extends BaseChain {
    private apiDocs: string;
    private options: OpenAPIChainOptions;
    private chainOpenAPI: SequentialChain;

    constructor(apiDocs: string, options?: OpenAPIChainOptions) {
      super();

      this.apiDocs = apiDocs;
      this.options = options || {};
    }

    async build() {
     // this.chainOpenAPI = await createOpenAPIChain(this.apiDocs, this.options);
     // this.inputKeys = this.chainOpenAPI.inputKeys;

      return this;
    }

    async _call(values: ChainValues, runManager?: CallbackManagerForChainRun): Promise<ChainValues> {
      const chainOpenAPI = await createOpenAPIChain(this.apiDocs, this.options)

      const rs = await chainOpenAPI.call(values);
      return rs;
    }

    _chainType(): string {
      return "openAPI_chain" as const;
    }

    /*
    set inputKeys(key: string[]) {
      [key]
    }
    */

    get inputKeys(): string[] {
      //const values = this.
      //return this.inputKeys;
   
      return [
        'query', 'referencies', 'input_documents', 'question', 'chat_history',
      ];
  
    }

    get outputKeys(): string[] {
      return [this.options?.llmChainInputs?.outputKey]
    }
    
}