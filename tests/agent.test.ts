import Agent from '../src/agent';
import { DataSource } from 'typeorm';
import { IAgentConfig } from '../src/interface/agent.interface';

const agentConfig = {}; //require(`./agent-configs/agent-code-reviwer.json`);

describe('Agent test', () => {
  it('should Agent instance', (done) => {
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

    expect(agent).toBeInstanceOf(Agent);

    done();
  });
});
