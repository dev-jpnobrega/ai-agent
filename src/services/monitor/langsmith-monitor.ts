import { configMonitorProps, IMonitor } from '.';
import { IMonitorConfig } from '../../interface/agent.interface';

class LangSmithMonitor implements IMonitor {
  private _settings: IMonitorConfig;

  constructor(settings: IMonitorConfig) {
    this._settings = settings;
  }

  add(): void {
    process.env.LANGCHAIN_TRACING_V2 = `true`;
    process.env.LANGCHAIN_ENDPOINT = this._settings?.endpoint;
    process.env.LANGCHAIN_API_KEY = this._settings?.apiKey;
    process.env.LANGCHAIN_PROJECT = this._settings?.projectName;
  }

  async startConversation(
    _chatThreadId: string,
    fn: () => void,
  ): Promise<void> {
    return await fn();
  }

  async withWorkflow(
    _props: configMonitorProps,
    fn: () => void,
  ): Promise<void> {
    return await fn();
  }
}

export default LangSmithMonitor;
