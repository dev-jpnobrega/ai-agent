import { IMonitorConfig, MONITOR_TYPE } from '../../interface/agent.interface';
import LangSmithMonitor from './langsmith-monitor';
import DynatraceMonitor from './dynatrace-monitor';

type configMonitorProps = {
  name: string;
  version?: number;
  associationProperties?: {
    [name: string]: string;
  };
  conversationId?: string;
  traceContent?: boolean;
  inputParameters?: unknown[];
  suppressTracing?: boolean;
};

interface IMonitor {
  add(): void;
  startConversation(chatThreadId: string, fn: () => void): Promise<void>;
  withWorkflow(props: configMonitorProps, fn: () => void): Promise<void>;
}

class MonitorFactory {
  public static create(settings?: IMonitorConfig): IMonitor | null {
    if (!settings?.type) {
      return null;
    }

    const { type } = settings;

    if (type === MONITOR_TYPE.LANGCHAIN_SMITH) {
      return new LangSmithMonitor(settings);
    }

    if (type === MONITOR_TYPE.DYNATRACE) {
      return new DynatraceMonitor(settings);
    }

    return null;
  }
}

export { MonitorFactory, IMonitor, configMonitorProps };
