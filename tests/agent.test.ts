import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import Agent from '../src/agent';
import { DataSource } from 'typeorm';
import { IAgentConfig } from '../src/interface/agent.interface';

const agentConfig = require(`./agent-configs/agent-openapi.json`);

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

  it('should Agent call', (t, done) => {
    const agentSettings = agentConfig as unknown as IAgentConfig;

    if (agentSettings.dataSourceConfig) {
      agentSettings.dataSourceConfig.dataSource = new DataSource({
        ...(agentSettings.dataSourceConfig as any),
      });
    }

    const agent = new Agent(agentSettings);

    agent.on('onMessage', async (message) => {
      assert.ok(message, 'message is not null');
      console.warn('MESSAGE:', message);
      done();
      process.exit(0);
    });

    agent.call({
      question: 'Qual estoque do produto 2771?',
      // question: 'O que preciso fazer para reprocessear um pedido SAC?',
      // question: 'qUAL MINHAS VISITAS AMANHA?',
      chatThreadID: '11',
      // context: 'Eu me chamo Joao Paulo e sou Arquiteto de Software',
      // context: 'Sou vendedor, meu telefone e o +5511970774145',
    });
  });
});
