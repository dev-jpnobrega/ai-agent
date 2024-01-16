import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import Agent from'../src/agent';

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
      }
    });
    assert.ok(agent instanceof Agent);

    done();
  });


  it('should Agent call', { skip: true }, (t, done) => {
    const agent = new Agent({
      name: 'Agent test Support',
      llmConfig: {
        type: 'azure',
        model: process.env.OPENAI_API_DEPLOYMENT_NAME || 'test',
        instance: process.env.OPENAI_API_INSTANCE_NAME || 'test',
        apiKey: process.env.OPENAI_API_KEY || 'test',
        apiVersion: process.env.OPENAI_API_VERSION || 'test',
      },
      chatConfig: {
        temperature: 0,
      },
      vectorStoreConfig: {
        apiKey: process.env.SEARCH_API_KEY || 'test',
        apiVersion: process.env.SEARCH_API_VERSION || 'test',
        name: process.env.SEARCH_NAME || 'test',
        type: 'azure',
        vectorFieldName: 'embedding',
        indexes: [
            'index-gdp'
        ],
        model: process.env.AZURE_SEARCH_MODEL || 'test'
      },
    });
  });
});