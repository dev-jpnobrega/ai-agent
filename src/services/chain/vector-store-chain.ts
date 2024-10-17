import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { RunnableSequence } from '@langchain/core/runnables';
import { IChain } from '.';

class VectorStoreChain implements IChain {
  create(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any>> {
    throw new Error('Method not implemented.');
  }
}

export default VectorStoreChain;
