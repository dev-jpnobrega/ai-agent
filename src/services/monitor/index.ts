import * as traceloop from '@traceloop/node-server-sdk';
import * as opentelemetry from '@opentelemetry/exporter-trace-otlp-proto';

import { IMonitorConfig, MONITOR_TYPE } from '../../interface/agent.interface';

class Monitor {
  static addMonitorDynatrace(settings?: IMonitorConfig) {
    const exporter = new opentelemetry.OTLPTraceExporter({
      url: settings?.endpoint,
      headers: {
        Authorization: `Api-Token ${settings?.apiKey}`,
      },
    });

    traceloop.initialize({
      logLevel: 'debug',
      appName: settings?.projectName,
      disableBatch: true,
      exporter,
    });
  }

  static addMonitorLangSmith(settings?: IMonitorConfig) {
    process.env.LANGCHAIN_TRACING_V2 = `true`;
    process.env.LANGCHAIN_ENDPOINT = settings?.endpoint;
    process.env.LANGCHAIN_API_KEY = settings?.apiKey;
    process.env.LANGCHAIN_PROJECT = settings?.projectName;

    return;
  }

  static add(settings?: IMonitorConfig) {
    const { type } = settings ?? {};

    if (type === MONITOR_TYPE.LANGCHAIN_SMITH) {
      return Monitor.addMonitorLangSmith(settings);
    }

    if (type === MONITOR_TYPE.DYNATRACE) {
      return Monitor.addMonitorDynatrace(settings);
    }
  }
}

export default Monitor;
