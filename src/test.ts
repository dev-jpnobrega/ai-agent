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
    region: "us-east-1",
    apiVersion: '2023-07-01-preview',
    apiKey: ''
    /*
    apiKey: 'ASIAVEKDIBUE4NLRNFPL',
    secretAccessKey: "U+VKv57dBP/kUyUbr4KEQkcnojOOtX3GESR7ayLI",
    sessionToken: "IQoJb3JpZ2luX2VjEJ3//////////wEaCXVzLWVhc3QtMSJIMEYCIQDS5YD7WcifswpHlIlTI626LTVzRmO1ZE9EbizoGTkL0gIhAKvgXu5dkU9sJOid9mL6Q6S9SAgNmETDnQhA6KISv07EKqcDCJX//////////wEQAxoMMzUyODY1MjI1OTkzIgx8fp2jyrFz+yZzPtgq+wJEYVKbABp/KBM6kougMCHkDoFJtI2NZ0vYLV2xheMM1G1xdwOVpx4kf6Dowhqat39Hy2WvAJGULFaxRfA6nODdbTXGFt2YpWFbe8eneDy76JvBxUfkoodPq1H80/jUYWo9ND1rXi2kGyKdAmvZBaMNhDXOiZNJ30gL8AUqcc0CGxcS5i2NpxBGPAlFzMIFWp1HQHiN/ILuwN1Wp8rTArgWH6+rPouhePni3+90n57RIPdznl6pv8lcbV0EFOO/xYb1AvQH5H+OZPdJfauI3wXVIpgJXBfZzpbPboIM1c7YCZwdKH7IUcxVJFDtwKg5H5vnOGxmAfB0Cohv+RSUnRfdx8HWHp6GZxy78QIf0hwMa49/FDooOLcVHG0nA6eIsOiDrfgW6zPRDokcC+1EmKB+/Rqe9c5yqx3MimAJ+PEZczHubXQapYsirmJivE7GmCVIEPeGNPqmO+/F4YWPnoEUbL+v1ZXMl4nwURC22fjPLZusF0CgQtg29zKwMLf8na8GOqUB7/7le0mgCSCwlZHoaXnGmLKeBNaAfHIhFSOqIXZhL7h6GmXbhifWITgwRUAYGrduKDjt0yzhB7f2l0rByQmvcEWMYRm9ov9v08WFmgDI/x0lcMB+0VcGs8bA9AUJC3cqQyyEwrNkGQCJqKQrQ3i+UeaoDHYPoEZ3OOdW2WPtk77SNwjyezN2jn7yiNsxMihXuIxyzT5wLFlIuDfPrvu21PAJ/jRT", 
    */
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
    embedding_model_id: "amazon.titan-embed-text-v1",
    temperature: 0.1,
    max_tokens_to_sample: 300,
    vectorFieldName: 'embedding',
    
    accessKey: 'ASIAVEKDIBUEWUVZALMM',
    secretAccessKey: 'hp1zxVugyggbayX2pQ06vbU+W6+FmE8VzYNFpz16',
    sessionToken: 'IQoJb3JpZ2luX2VjEMf//////////wEaCXVzLWVhc3QtMSJHMEUCIGvWzAzrHtTbaLlz9UeDPqA63bJzyjddMW1g1dmndo+mAiEAoLY8yscPB6K7CQBGFKimpsCsd5cR+JJQQmx6eA5/BUoqpwMIwP//////////ARADGgwzNTI4NjUyMjU5OTMiDIN1KkZ+4nJmWimSwir7AsTD7AuaKV1ChNtu5PeqXtWZ0JmZs4pjc0aEScsalGur5wV+fY+RmtiCdo7E/VuWx592G8X+PLhmef+tpEkhGHjmETMEh4Do/4ZaYr6imAmq/mS6jmkx5t8/BeHQK6XqFvNKlFuDDVT0mYwrsTjOzbmBZNvuBqxXm2xY0QtO49DZCe8StJWihex7YOvkndsZ4Yf1P2mTGsMzWEFXVyG4W16ghLVPLMtCK3Q/tXau31U8D/RqS5wmnxgZVZ/vxzBNOehqpTCDWABIgf33brUHwiIKSjLPr7VyApsRnQxQ5ueSpVF314Cmo9jT7D6kk61mJzjUIcR4q7Cq1cALHEiLWUTdUpOLlgY+Tg1ViUkKehumzaF0XiJ/3etIGSICJhM7dokmJH5upSsh/+skhXhv+DYq9MDjACjQcSk50ZOyqzWwMLO4djQzpIKSFbV6OaZBjZO9fQg8clGMpa+c+zqvY1jGjrk9Vi3BGahfHqE+f6Huev6/O5QhkyISDv0wl6KnrwY6pgEHX6nq6KUn4ORtD6X4roM39+YjvLVCYz2bioA9GuGD5V5wqiHT+M8Ok18wcoDHArD/Jbb12PUcXS7pgsGutQqOsbEkhOffimR//RmObeCQzG7EtH4f8Qnp2cOmDSjGG4RI0vXjgMgypnx41bLauiN89aL1T2xK7IM0hpWiU3jign3ake4Z7jStb5NCGnWmKx+yH+AcrMiQAToz8Q0QPvxu0DKYNBNf',
    customizeSystemMessage: 'Human: Você é a MAIA, a inteligência artificial do GDP (Global Data Platform), você pode responder perguntas relacionadas indicadores de estrutura comercial da Natura. Use as seguintes partes do contexto para fornecer uma resposta concisa à pergunta no final. Responda de forma mais natural possivel. Se você não sabe a resposta, apenas diga que não sabe, não tente inventar uma resposta. Se o usuário te cumprimentar, apenas cumprimente de volta, não tente consultar o contexto. Se apresente e diga o que você pode fazer somente se o usuário perguntar.\n'
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