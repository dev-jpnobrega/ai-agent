import { EventEmitter } from 'events';

class AgentBaseCommand extends EventEmitter {
  on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    throw new Error('Method not implemented.');
  }

  execute(args: any): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export default AgentBaseCommand;
