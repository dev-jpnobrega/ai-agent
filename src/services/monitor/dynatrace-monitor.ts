import * as traceloop from '@traceloop/node-server-sdk';
import * as opentelemetry from '@opentelemetry/exporter-trace-otlp-proto';

import { IMonitorConfig } from '../../interface/agent.interface';
import { IMonitor, configMonitorProps } from '.';

class DynatraceMonitor implements IMonitor {
  private _settings: IMonitorConfig;

  constructor(settings: IMonitorConfig) {
    this._settings = settings;
  }

  add(): void {
    const exporter = new opentelemetry.OTLPTraceExporter({
      url: this._settings?.endpoint,
      headers: {
        Authorization: `Api-Token ${this._settings?.apiKey}`,
      },
    });

    traceloop.initialize({
      logLevel: 'debug',
      appName: this._settings?.projectName,
      disableBatch: true,
      exporter,
    });
  }

  async startConversation(chatThreadId: string, fn: () => void): Promise<void> {
    return await traceloop.withConversation(chatThreadId, fn);
  }

  async withWorkflow(props: configMonitorProps, fn: () => void): Promise<void> {
    return await traceloop.withWorkflow(props, fn);
  }
}

export default DynatraceMonitor;
