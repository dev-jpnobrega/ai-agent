import { EventEmitter } from 'events';
import { IInputProps } from './interface/agent.interface';

class AgentBaseCommand extends EventEmitter {
  async call(args: IInputProps): Promise<void> {
    throw new Error('Method not implemented.');
  }
  execute(args: any): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export default AgentBaseCommand;
