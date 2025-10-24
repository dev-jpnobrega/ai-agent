import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import Agent from '../src/agent';
import { DataSource } from 'typeorm';
import { IAgentConfig } from '../src/interface/agent.interface';
import { readFileSync } from 'node:fs';

const agentConfig = require(`./agent-configs/agent-img-generation.json`);

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

    const imageBuffer = readFileSync('./template_2.png');
    const imageProductsBuffer = readFileSync('./NATBRA-89247_1.jpg');

    agent.call({
      // question: 'Quem ganhou a ultima copa do mundo?',
      // question: 'Limpar o cache da pessoa a443bf0e-4c76-42f8-a084-c6544309f111?',
      question: `
         Adicione dentro do quadrado no canto inferior direto o texto "DE: R$ 45.00 POR: R$ 30.00".
         Adicione o produto da segunda imagem no centro da primeira imagem template. 
         O produto deve estar dentro do retangulo branco transparente no centro da imagem template, caso a imagem do produto esteja grande, redimencione para caber.
         Mantenha as outras caracteristicas sem alteracoes de textos, letras, cores ou qualquer outra coisa.
         Sempre gere a imagem na melhor qualidade possivel.
        `,
      images: [
        {
          mimeType: 'image/png',
          data: imageBuffer.toString('base64'),
        },
        {
          mimeType: 'image/jpeg',
          data: imageProductsBuffer.toString('base64'),
        },
      ],
      // question: 'O que preciso fazer para reprocessear um pedido SAC?',
      // question: 'qUAL MINHAS VISITAS AMANHA?',
      chatThreadID: 'dwdw',
      // context: 'Eu me chamo Joao Paulo e sou Arquiteto de Software',
      // context: 'Sou vendedor, meu telefone e o +5511970774145',
    });
  });
});
