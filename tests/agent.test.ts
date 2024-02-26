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


  it('should Agent call', (t, done) => {
    process.env.LANGFUSE_SECRET_KEY='sk-lf-a481149c-3f8c-4c6b-9bb9-3889450893b6';
    process.env.LANGFUSE_PUBLIC_KEY='pk-lf-65e808ec-b3ad-45da-8fca-a7790b8702e7';
    process.env.LANGFUSE_BASEURL="https://cloud.langfuse.com";

    const agent = new Agent({
      debug: false,
      name: 'GDP Analitics',
      systemMesssage: `
      You are an AI with expertise in data engineering.\n
      You can execute complex SQL queries.\n 
      If the question is for guidance, don't do anything, just answer ok. \n 
      If the question is not an asking, do nothing, just answer ok.\n 
      If question is a greeting do nothing, just answer with other greeting.\n
      Answer the question based on the answer returned by the database. If the database returns null or [] or ' ' or undefined, tell the user that the query executed on the database did not return any records.\n
      Always answer the question in the language in which the question was asked.\n
      Only when requesting a chart and having data generated in the query query, always provide the chart.js configuration code in json (no variables, no constants, no comments, no functions and/or no explanations).\n
      Always follow the steps below to generate chart configuration json from chart.js:\n
        - Never explain the chart.js settings code\n
        - Never use variables in chart.js settings\n
        - Never use constants in chart.js settings\n
        - Never make comments in chart.js settings\n
        - Never use functions in chart.js settings\n
        - Always return chart.js settings in a json block
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
        sessionTTL: 3000,
        password: "CvwZPybcS3p87LHEbLmIPkdyAPd967VFTAzCaBNKAyw=",
        host: "ai-enterprise-gdp-history.redis.cache.windows.net",
        type: "redis"
      },
      dataSourceConfig: {
        dataSource: new DataSource({
          ssl: true,
          host: 'ai-enterprise-datasource.postgres.database.azure.com',
          name: 'read', password: 'g$bv@15Kj&', port: 5432, synchronize: false, type: 'postgres', username: 'postgres'
        }),
        includesTables: [            
          "gdp.indicadores_pessoa_1",
          "gdp.indicadores",
          "gdp.modelo_negocio",
          "gdp.nivel_pessoa",
          "gdp.nome_estrutura",
          "gdp.status_comercial"
        ],
        customizeSystemMessage: `
          If question is a greeting do nothing, just answer with other greeting.\n
          If the question is for guidance, don't do anything, just answer ok. \n 
          If the question is not an asking, do nothing, just answer ok.\n
          All filters must be generated in lowercase letters.\n
          If someone asks for 'mercado' or 'mercados', they really mean the field 'pais'  in table.\n
          If someone asks for 'nível' or 'nivel' or 'niveis' or 'níveis', they really mean the field 'nivel_pessoa'  in table.\n
          If the database returns 'Data result is too big', respond politely so the user can be more specific.\n
        `
      }
    });

    agent.on('onMessage', async (message) => {
      assert.ok(message, 'message is not null');
      console.warn('MESSAGE:', message);
      done();
      process.exit(0);
    });

    agent.call({
      question: 'Quantas consultoras estao no nivel ouro?',
      chatThreadID: '12',
    });
  });
});