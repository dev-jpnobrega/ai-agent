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
});
