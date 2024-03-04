import { DataSource } from 'typeorm';
import { Agent } from './index';
import { IAgentConfig } from './interface/agent.interface';
 
// data: '{"openapi":"3.0.1","info":{"title":"Estoque","description":"Consulteoestoquedequalquerproduto","version":"v1"},"servers":[{"url":"https://gsp-availability-api-int.qa.naturacloud.com/globalsales/availability"}],"paths":{"/v1/product-available":{"get":{"summary":"Consultaestoquedeprodutopelocodigodoproduto,country,companyetipodeinventario","parameters":[{"name":"productCode","description":"Codigodoprodutoaserprocurado","in":"query","required":true,"schema":{"type":"integer"}},{"name":"countryCode","description":"CodigodoPaísdereferencia","in":"query","required":true,"schema":{"type":"string"}},{"name":"companyId","description":"Codigodacompania","in":"query","required":true,"schema":{"type":"integer"}},{"name":"inventoryTypeId","description":"Codigodotipodeinventárioondeoestoqueesta.","in":"query","required":true,"schema":{"type":"integer"}}],"responses":{"200":{"description":"OK","content":{"application/json":{"schema":{"type":"array","items":{"$ref":"#/components/schemas/getStockResponse"}}}}}}}}},"components":{"schemas":{"getStockResponse":{"type":"object","properties":{"productCode":{"type":"integer","description":"Codigodoprodutoconsultado,emcasodekitéumdosprodutosquecompoemokit."},"required":{"type":"boolean","description":"Seoprodutoéounãoobrigatorio."},"totalAvailable":{"type":"integer","description":"Totaldedisponibilidadesomandoadisponibilidadedosmateriais"},"availability":{"type":"array","xml":{"wrapped":true},"items":{"$ref":"#/components/schemas/availability"}}}},"availability":{"type":"object","properties":{"available":{"type":"integer","description":"Disponibilidadedoprodutoparaodentrodedistribuiçãodereferência."},"distributionCenterCode":{"type":"integer","description":"Centrodedistribuição."},"firmAllocation":{"type":"integer","description":"Quantidadeutilizadaoureservadaempedidos"},"softCommitment":{"type":"integer","description":"Quantidadeutilizadaoureservadaemcarrinhos"}}}}}}',
 
const agentSettings = {
  name: 'gdp-agent-pessoa',
  chatConfig: {
    temperature: 0,
    maxTokens: 2048,
  },
  llmConfig: {
    type: 'bedrock',
    model: 'anthropic.claude-v2',
    instance: 'ai-enterprise',
    apiKey: 'ASIAVEKDIBUE2DAVRM74',
    region: "us-east-1",
    apiVersion: '2023-07-01-preview',
    secretAccessKey: "zDslGUshcUl0y+GC4u8/ltZBVch7XhgUd7jEt5Tk",
    sessionToken: "IQoJb3JpZ2luX2VjEIX//////////wEaCXVzLWVhc3QtMSJHMEUCIB3sa2bP//l6QTAfGAPOXBpPIAN4o3lUHhuvhOfPWFq7AiEArwxKVJxn+Mcd/FFjGCSy9pXubUpLBjCuZJOTj1gB8KQqngMIfhADGgwzNTI4NjUyMjU5OTMiDDYq/kS43snI4y7N3Sr7AsRDPKfscg+TksFWbrEfCUjXdbBu4es1LFgjx+HdsckUJRv0UvzbinEXXg9g/NsrNLv0F8CSDsLUeJh4HWqxXForZeiVHOTkNEEvd67+6xJ+x9fdF4hwHQZRIP4kpeSav+SPIcvMW1kdiaApSth/tqF36Hssed85EfeM78sXECSzSdCa0pSi8mXd3yi2q4o+XeaTDa0prZapNKdTL4jnAPgGQgOFJBjp5m6rpqhmsiMMxYZMFZzk3vwPFFQe9R/2yot1bfdbpJwx6BubRYMHkoa335J1x43TMozWu8SX6P8l18z+GlpdDG7FQsofSvpVlzl6lYmXTW7xExKvOcTLf17PyXiX1cWUpxD3sIfBS4qazspgvpeobx+WWmVbneK4tR4JTwFBgs8prHo/5iuHJTCVF23S5pGZrVDRgbC/ZmNa9O3qw0Vr1LFOw0pEn06yUgsn0gtdyotfcrACGMBN05jtvoqUSdfjyS+tGXR7VbZK8jTB7x5cPh70Jvgw7N6YrwY6pgGPEv0R65z281rXeelouV+sl85NlH92eOubXeXh4fyeX3UhW9owGQKarK9RkvYQe46eXAP0axmjoniMvsymvks0Zq7pbrdmuOzTGsdOcNwxDAucamaahgE18DVLQz3lurDI4gX0AZCgIiGz8KI2HfFrIxeWDVWbhygme4vm2jHe0ihCy/R1Kz9yjJgtHSvCDIDxt2Cl7TD5EW/uoOrvYfk7HzW1EHi+",
  },
  llmConfig_: {
    type: 'azure',
    model: 'gpt4',
    instance: 'ai-enterprise',
    apiKey: '76173864cd0745dd9417c7cbd7008241',
    apiVersion: '2023-07-01-preview',
  },
  //   llmConfig: {
  //     type: 'google',
  //     model: 'gemini-pro',
  //     apiKey: 'AIzaSyAK3EDA1wRHAtd-3dgSfggBgNNWMCEzAeU',
  //     maxOutputTokens: 2048
  //   },
  systemMesssage: `
      You are an AI with expertise in data engineering.\n
      You can execute complex SQL queries.\n
      If the question is for guidance, don't do anything, just answer ok. \n
      If the question is not an asking, do nothing, just answer ok.\n
      If question is a greeting do nothing, just answer with other greeting.\n
      Answer the question based on the answer returned by the database. If the database returns null or [] or ' ' or undefined, tell the user that the query executed on the database did not return any records.\n
      Always answer the question in the language in which the question was asked.\n
      `,
  dbHistoryConfig: {
    port: 6380,
    sessionTTL: 3000,
    password: 'CvwZPybcS3p87LHEbLmIPkdyAPd967VFTAzCaBNKAyw=',
    host: 'ai-enterprise-gdp-history.redis.cache.windows.net',
    type: 'redis',
    limit: 5,
  },
  openAPIConfig_: {
    customizeSystemMessage:
      'For questions that cannot be answered, respond by invoking the chat endpoint.\nIf the user requests the creation of a conversation with agents, use the /chat endpoint with the information provided.\n',
    data: `{
                "openapi": "3.0.1",
                "info": {
                    "title": "AI Enterprise API",
                    "description": "This API is responsible for the creation, education and administration of AI agents, it is also a chat endpoint for conversations.",
                    "version": "v1"
                },
                "servers": [
                    {
                        "url": "https://ai-enterprise-api.azurewebsites.net/workout"
                    }
                ],
                "paths": {
                    "/v1/agent": {
                        "post": {
                            "summary": "This endpoint facilitates the creation of AI agents, allowing users to generate intelligent virtual entities for various applications. Users can leverage this functionality to design and deploy agents equipped with artificial intelligence capabilities, enhancing their systems with autonomous and intelligent decision-making.",
                            "operationId": "agentPost",
                            "requestBody": {
                                "required": true,
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/agent"
                                        }
                                    }
                                }
                            },
                            "responses": {
                                "200": {
                                    "description": "Agent created successfully",
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": "#/components/schemas/agent"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "/v1/chat": {
                        "post": {
                            "summary": "This chat endpoint facilitates communication with various agents, allowing users to interact with different conversational entities. Users can engage with distinct chat agents through this endpoint, enabling versatile and dynamic conversations tailored to specific contexts or purposes.",
                            "operationId": "chatPost",
                            "requestBody": {
                                "required": true,
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/chatPost"
                                        }
                                    }
                                }
                            },
                            "responses": {
                                "200": {
                                    "description": "Text with the agent's response",
                                    "content": {
                                        "text/plain": {
                                            "schema": {
                                                "type": "string"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                "components": {
                    "schemas": {
                        "agent": {
                            "type": "object",
                            "description": "Properties that represent an AI Agent.",
                            "properties": {
                                "key": {
                                    "type": "string",
                                    "description": "Agent identification UUID."
                                },
                                "name": {
                                    "type": "string",
                                    "description": "Agent name."
                                },
                                "systemMesssage": {
                                    "type": "string",
                                    "description": "This field serves as a prompt ingestion point, enabling users to input and process prompts for natural language understanding tasks. It allows users to submit prompts, which are then utilized by the system to generate responses or perform specific language-related tasks. This feature streamlines the integration of user-provided prompts into the system for efficient and customized interactions."
                                },
                                "llmConfig": {
                                    "type": "object",
                                    "description": "This field serves as a storage container for storing connection configurations with AI services. It allows users to save and manage settings related to the connection parameters required for interacting with AI services. This facilitates seamless integration and communication between the system and various AI services by storing essential connection details and preferences.",
                                    "properties": {
                                        "type": {
                                            "type": "string",
                                            "description": "Cloud provider type.",
                                            "enum": [
                                                "azure",
                                                "aws",
                                                "gcp"
                                            ]
                                        },
                                        "model": {
                                            "type": "string",
                                            "description": "This field is designated for specifying the name of a language model (LLM). Users can use this field to input and manage the distinctive identifier or label associated with a particular language model. It aids in the organization and recognition of different language models within a system, facilitating easy reference and usage."
                                        },
                                        "instance": {
                                            "type": "string",
                                            "description": "Instance name or instance uri."
                                        },
                                        "apiKey": {
                                            "type": "string",
                                            "description": "API key if necessary."
                                        },
                                        "apiVersion": {
                                            "type": "string",
                                            "description": "API version if necessary."
                                        }
                                    }
                                },
                                "chatConfig": {
                                    "type": "object",
                                    "description": "This field serves as a storage space for chat configuration parameters, including but not limited to temperature and max tokens. Users can utilize this field to store and manage specific settings that influence the behavior of a chat system, such as the response creativity (temperature) and the maximum number of tokens allowed in a response. It enables users to customize and fine-tune the chat experience according to their preferences and requirements.",
                                    "properties": {
                                        "temperature": {
                                            "type": "number",
                                            "description": "This field is designated to store the chat temperature configuration, allowing users to set values within the range of 0.1 to 1. The temperature parameter influences the creativity and randomness of responses in the chat system. Users can customize this setting to control the level of variation and diversity in the generated chat outputs, with lower values leading to more focused responses and higher values introducing greater unpredictability.",
                                            "enum": [
                                                0,
                                                0.1,
                                                0.2,
                                                0.3,
                                                0.4,
                                                0.5,
                                                0.6,
                                                0.7,
                                                0.8,
                                                0.9,
                                                1
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        "message": {
                            "type": "object",
                            "description": "Fields to message.",
                            "required": [
                                "content"
                            ],
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "Message content."
                                },
                                "createdAt": {
                                    "type": "string",
                                    "description": "Message creation date."
                                }
                            }
                        },
                        "chatPost": {
                            "type": "object",
                            "description": "Information needed to open a chat and send messages.",
                            "properties": {
                                "body": {
                                    "type": "object",
                                    "description": "Information needed to open a chat and send messages.",
                                    "properties": {
                                        "agentUid": {
                                            "type": "string",
                                            "description": "UUID key of the agent where the conversation will be initiated."
                                        },
                                        "id": {
                                            "type": "string",
                                            "description": "Conversation UUID key, if any."
                                        },
                                        "userId": {
                                            "type": "string",
                                            "description": "User UUID key, if any."
                                        },
                                        "messages": {
                                            "type": "array",
                                            "description": "Array of messages.",
                                            "items": {
                                                "type": "object",
                                                "$ref": "#/components/schemas/message"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }`,
  },
  vectorStoreConfig: {
    type: 'bedrock',
    indexes: ['bedrock-gdp-rag-index'],
    model: 'anthropic.claude-v2:1',
    clientUrl: "https://oibsdrs1b4kf1ypbap0d.us-east-1.aoss.amazonaws.com",
    embedding_model_id: "amazon.titan-embed-text-v1",
    temperature: 0.1,
    max_tokens_to_sample: 300,
    vectorFieldName: 'embedding',
  },
  vectorStoreConfig_: {
    apiKey: 'OZLHFdd4s4Fa6IKB6BHoWmloe5IlR2PMii7aDV9ut1AzSeCjN7yz',
    indexes: ['index-gdp'],
    vectorFieldName: 'embedding',
    type: 'azure',
    name: 'ai-enterprise-gdp-search',
    apiVersion: '2023-07-01-Preview',
    model: 'textembeddingada',
  },
  documentIntellegenciConfig_: {
    endpoint:
      'https://ai-enterprise-doc-intelligence.cognitiveservices.azure.com/',
    apiKey: '0ff7b4f2f3fd4745a411e8ff5d1ec6d2',
    type: 'azure',
  },
  dataSourceConfig_: {
    ssl: true,
    type: 'postgres',
    database: 'postgres',
    includesTables: [
      'gdp.indicadores_pessoa_1',
      'gdp.indicadores',
      'gdp.modelo_negocio',
      'gdp.nivel_pessoa',
      'gdp.nome_estrutura',
      'gdp.status_comercial',
    ],
    port: 5432,
    host: 'ai-enterprise-datasource.postgres.database.azure.com',
    username: 'postgres',
    password: 'g$bv@15Kj&',
    name: 'read',
    synchronize: false,
    dataSource: undefined,
    customizeSystemMessage: `
          If question is a greeting do nothing, just answer with other greeting.\n
          If the question is for guidance, don't do anything, just answer ok. \n
          If the question is not an asking, do nothing, just answer ok.\n
          All filters must be generated in lowercase letters.\n
          If someone asks for 'mercado' or 'mercados', they really mean the field 'pais'  in table.\n
          If someone asks for 'nível' or 'nivel' or 'niveis' or 'níveis', they really mean the field 'nivel_pessoa' in table.\n
          If the database returns 'Data result is too big', respond politely so the user can be more specific.\n
        `,
  },
  key: '0ccf57b0-933c-4774-9c2e-366ee6c1df83',
} as IAgentConfig;
 
if (agentSettings?.dataSourceConfig) {
  agentSettings.dataSourceConfig.dataSource = new DataSource({
    ...(agentSettings.dataSourceConfig as any),
  });
}
 
const agent = new Agent(agentSettings);
 
agent.on('onMessage', (message: string) => {
  console.log('Resposta = ', message);
});
 
agent.on('onToken', (token: string) => {
  console.warn(token);
});
 
agent.call({
  userSessionId: 'currentUser',
  chatThreadID: '007',
//   question:
    //'Me fale o nome de 5 consultores que o nome começa com a letra M',
  /* question:
       'Crie um chat com o agentUid 2ad7763d-d067-4819-930a-a1d66488b4e6, userId 2764c812-3fe2-4982-88ad-c1df679ead7c, mandando a seguinte mensagem - Forneca informacoes sobre a aplicacao de imposto no GSP?', */
  //   question: 'Quem é leonardo da vinci?',
    question: 'Com base nos seus conhecimentos, quais perguntas posso te fazer ?',
});
//   .then(() => {
//     agent.call({
//       userSessionId: 'currentUser',
//       chatThreadID: '88776655443322110099',
//       question: 'Reformule a resposta da pergunta anterior',
//     });
//   });