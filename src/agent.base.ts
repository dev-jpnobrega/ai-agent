import { EventEmitter } from 'events';

class AgentBaseCommand extends EventEmitter {
  execute(args: any): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export default AgentBaseCommand;
