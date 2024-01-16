import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import Agent from'../src/agent';
import { DataSource } from 'typeorm';

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


  it('should Agent call', (t, done) => {5
    const agent = new Agent({
      debug: false,
      name: 'GDP Analitics',
      systemMesssage: `
      You are an AI with expertise in data engineering.\n
      You can execute complex SQL queries.\n
      Always answer the question in the language in which the question was asked.\n
      `,
      llmConfig: {
        type: 'azure',
        model: process.env.OPENAI_API_DEPLOYMENT_NAME || 'gpt4',
        instance: process.env.OPENAI_API_INSTANCE_NAME || 'ai-enterprise',
        apiKey: process.env.OPENAI_API_KEY || '76173864cd0745dd9417c7cbd7008241',
        apiVersion: process.env.OPENAI_API_VERSION || '2023-07-01-preview',
      },
      chatConfig: {
        temperature: 0,
      },
      dbHistoryConfig: {
        port: 6380,
        sessionTTL: 3,
        password: 'CvwZPybcS3p87LHEbLmIPkdyAPd967VFTAzCaBNKAyw=', 
        host: 'ai-enterprise-gdp-history.redis.cache.windows.net', 
        type: 'redis'
      },
      dataSourceConfig: {
        dataSource: new DataSource({
          ssl: true,
          host: 'ai-enterprise-datasource.postgres.database.azure.com',
          name: 'read', password: 'g$bv@15Kj&', port: 5432, synchronize: false, type: 'postgres', username: 'postgres'
        }),
        includesTables: ['gdp.indicadores_pessoa'],
        customizeSystemMessage: `
        Look at the "pais" column to translate value to the  SQL query filters;\n
        - When "pais" is PE, convert the filter value to the Spanish language.\n
        - When "pais" is MY, convert the filter value to the English language.\n\n
        All filters must be generated in lowercase letters.\n
        If someone asks for 'mercado' or 'mercados', they really mean the field 'pais'  in table.\n
        If someone asks for 'nível' or 'nivel' or 'niveis' or 'níveis', they really mean the field 'nivel_pessoa'  in table.\n
        Answer the question based on the answer returned by the database. If the database returns result is too big, null or [] or ' ' or undefined, politely ask the user to re-ask the question and be more specific.\n
        `
      }
    });

    agent.on('onMessage', async (message) => {
      assert.ok(message, 'message is not null');
      console.warn('MESSAGE:', message);
      done();
    });

    agent.call({
      question: 'Qual a média do indicador "faturamento total" para cada nível das consultoras ?',
      chatThreadID: '2',
    });
  });
});