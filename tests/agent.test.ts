import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import Agent from '../src/agent';
import { DataSource } from 'typeorm';
import { IAgentConfig } from '../src/interface/agent.interface';

const agentConfig = require(`./agent-configs/gcp-agent.json`);

describe('Agent test', () => {
  it('should Agent instance', (t, done) => {
    const agent = new Agent({
      llmConfig: {
        apiKey: '123',
        apiVersion: '1.0',
        type: 'azure',
        instance: 'test',
        model: 'test',
      },
      chatConfig: {
        temperature: 0.5,
      },
    });

    assert.ok(agent instanceof Agent);

    done();
  });

  it.skip('should Agent call', (t, done) => {
    const agentSettings = agentConfig as unknown as IAgentConfig;

    if (agentSettings.dataSourceConfig) {
      agentSettings.dataSourceConfig.dataSource = new DataSource({
        ...(agentSettings.dataSourceConfig as any),
      });
    }

    const agent = new Agent(agentSettings);

    agent.on('onToken', (error) => {
      console.log('onToken:', error);
    });

    agent.on('onError', (error) => {
      console.error('ERROR:', error);
      done();
      process.exit(0);
    });

    agent.on('onMessage', async (message) => {
      assert.ok(message, 'message is not null');
      console.warn('MESSAGE:', message);
      done();
      process.exit(0);
    });

    agent.call({
      question: 'Nível da CB 10363971, CL , 202513?',
      chatThreadID: 'id01',
    });
  });
});
