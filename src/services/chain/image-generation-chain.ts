import { VectorStore } from '@langchain/core/vectorstores';
import {
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import {
  AIMessagePromptTemplate,
  BasePromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { createRetrievalChain } from 'langchain/chains/retrieval';

import {
  IAgentConfig,
  IInputProps,
  ImageData,
} from '../../interface/agent.interface';
import { IChain } from '.';

import VectorStoreFactory from '../vector-store';
import { interpolate } from '../../helpers/string.helpers';

import { AzureOpenAI } from 'openai';

import * as fs from 'fs';
import { Canvas, Image } from 'canvas';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatGoogle } from '@langchain/google-gauth';
import { GoogleGenAI, MediaResolution } from '@google/genai';

class ImageGenrationChain implements IChain {
  private _settings: IAgentConfig;
  private _outputKey = 'imageGenerated';
  private _service: VectorStore;
  private _llm: BaseLanguageModel;

  constructor(settings: IAgentConfig) {
    this._settings = settings;
  }

  private getVectorStorePrompt(): string {
    return `
      Given the following inputs, formulate a concise and relevant response:\n
      1. User Rules (from USER CONTEXT > USER RULES), if provided\n
      2. User Context (from USER CONTEXT > CONTEXT), if available\n
      3. Document Context (from Context found in documents), if provided\n
      4. API Output (from API Result), if available\n
      5. Database output (from database result), if available. If database output is filled, use it for final answer, do not manipulate.\n\n\n\n
      
      Response Guidelines:\n
      - Prioritize User Rules and User Context if they are filled in.\n
      - Do not generate or fabricate information:\n
        Only use the data explicitly provided in the User Rules, User Context and Document Context. If the necessary information is not available, inform the user that the data is missing or request more details. Do not speculate or make assumptions beyond the provided information.\n
      - Ignore irrelevant conversation logs that dont pertain directly to the user's query.\n
      - Only respond if a clear question is asked.\n
      - The question must be a single sentence.\n
      - Remove punctuation from the question.\n
      - Remove any non-essential words or irrelevant information from the question.\n\n

      Focus on Accuracy and Timeliness:\n
      - Check for inconsistencies: If there are contradictions between different sources (e.g., documents, database, or user context), prioritize the most reliable information or request clarification from the user.\n
      - Consider time relevance: Always take into account the temporal nature of information, prioritizing the most updated and contextually relevant data.\n\n
      
      Input Data:\n
      - User Rules: {user_prompt}\n
      - User Context: {user_context}\n
      - Document Context: {context}\n
    `;
  }

  private buildPromptTemplate(systemMessages: string): BasePromptTemplate {
    const combine_messages = [
      SystemMessagePromptTemplate.fromTemplate(systemMessages),
      new MessagesPlaceholder('history'),
      AIMessagePromptTemplate.fromTemplate(
        'Wait! We are searching our VectorStore API.'
      ),
      HumanMessagePromptTemplate.fromTemplate('{input}'),
    ];

    const CHAT_COMBINE_PROMPT =
      ChatPromptTemplate.fromMessages(combine_messages);

    return CHAT_COMBINE_PROMPT;
  }

  private vectorToImage(vector: number[], width: number, height: number) {
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    const imageData = ctx.createImageData(width, height);

    for (let i = 0; i < vector.length; i += 4) {
      imageData.data[i] = vector[i]; // Red
      imageData.data[i + 1] = vector[i + 1]; // Green
      imageData.data[i + 2] = vector[i + 2]; // Blue
      imageData.data[i + 3] = 255; // Alpha (opaco)
    }

    ctx.putImageData(imageData, 0, 0);

    const buffer = canvas.toBuffer('image/png');

    fs.writeFileSync('./temp_image.png', buffer);
  }

  private buildPrompt(text: string, dataUrl: string) {
    const message = [
      {
        type: 'text',
        text,
      },
      {
        type: 'image_url',
        image_url: dataUrl,
      },
    ];

    const messages = [new HumanMessage({ content: message })];
    const template = ChatPromptTemplate.fromMessages(messages);
    return template;
  }

  private parserResult(response: any) {
    const candidates = response?.candidates || [];

    let resp = '';

    for (
      let candidate_index = 0;
      candidate_index < candidates.length;
      candidate_index++
    ) {
      for (
        let part_index = 0;
        part_index < candidates[candidate_index].content.parts.length;
        part_index++
      ) {
        const part = candidates[candidate_index].content.parts[part_index];
        if (part.inlineData) {
          try {
            resp += `
              <img src="data:${part.inlineData.mimeType};base64,${part.inlineData.data}" alt="Generated Image" /> \n
            `;

            const filename = `output_${candidate_index}_${part_index}.png`;

            fs.writeFileSync(
              filename,
              Buffer.from(part.inlineData.data, 'base64')
            );
            console.log(`Output written to: ${filename}`);
          } catch (err) {
            console.error(err);
          }
        }

        if (part.text) {
          resp += `${part.text}\n`;
        }
      }
    }

    return resp;
  }

  private createPartInlineData(
    mimeType: string,
    data: string
  ): { inlineData: { mimeType: string; data: string } } {
    return {
      inlineData: {
        mimeType,
        data,
      },
    };
  }

  private async generationImages(input: any) {
    const prompt = this.buildPromptTemplate(this.getVectorStorePrompt());
    return new Promise(async (resolve, reject) => {
      try {
        const { documents = [], images = [] } = input;
        const { answer, context } = documents;

        //const { imageBase64 } = context[0];
        const imgs = images.map((img: ImageData) =>
          this.createPartInlineData(img.mimeType, img.data)
        );

        const inputQuestion = `
          ${this._settings.systemMesssage}\n\n
          
          Pergunta do usuario: ${input.question}\n
        `;

        const ai = new GoogleGenAI({
          apiKey: 'AIzaSyDp-T7yzCq5nxfSmQiBAcup_jDNmkjBwL8',
        });

        const contents = [{ text: inputQuestion }, imgs];

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash-exp-image-generation', // 'imagen-3.0-generate-002',
          contents: contents,
          config: {
            // mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
            temperature: this._settings.chatConfig.temperature || 0.9,
            maxOutputTokens: 8192,
            //systemInstruction: this._settings.systemMesssage,
            responseModalities: ['Text', 'Image'],
          },
        });

        /*
        

        const genAI = new GoogleGenerativeAI(
          'AIzaSyDp-T7yzCq5nxfSmQiBAcup_jDNmkjBwL8'
        );
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash',
        });
        const generationConfig = {
          temperature: 1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,

          //responseModalities: ['image', 'text'],
          //responseMimeType: 'text/plain',
        };

        const chatSession = model.startChat({
          generationConfig,
          history: [],
        });

        const response = await chatSession.sendMessage([
          inputQuestion,
          {
            inlineData: {
              mimeType: 'image/png',
              data: img,
            },
          },
        ]);
        */

        /*
        
        const model = new ChatGoogle({
          modelName: 'gemini-2.0-flash',
          apiKey: 'AIzaSyDp-T7yzCq5nxfSmQiBAcup_jDNmkjBwL8',
          temperature: 0.9,
          //responseModalities: ['IMAGE', 'TEXT'],
          //responseMimeType: 'text/plain',
          maxOutputTokens: 8192,
        });
         const ia = new ChatGoogleGenerativeAI({
          apiKey: 'AIzaSyDp-T7yzCq5nxfSmQiBAcup_jDNmkjBwL8',
          temperature: 0.9,
          modelName: 'gemini-2.0-flash',
          maxOutputTokens: 8192,
          streaming: true,
        });

        const dallEAPI = new AzureOpenAI({
          endpoint: 'https://ai-enterprise-image.openai.azure.com/',
          deployment: `dalle3`,
          apiKey: this._settings.llmConfig.apiKey,
          apiVersion: '2024-05-01-preview',
          // openAIApiKey: this._settings.llmConfig.apiKey,
          // temperature: 0.9,
        });
                const inputQuestion = `
          Você é um Agente de IA especializado em geracao de images para banner e marketing, responda a questao do usuario gerando uma imagem.\n
          Pergunta do usuario: ${input.question}\n
        `;

        const inputQuestion = `descreva esse imagem`;
        */

        //this.vectorToImage(imageEmbedding, 512, 512);

        //const imgfs = fs.createReadStream('./temp_image.png');
        /*
        const response = await dallEAPI.images.generate({
          //image: imgfs,
          prompt: inputQuestion,
          model: 'dalle3',
          size: '1024x1024',
          //quality: 'standard',
        });
        const message = new HumanMessage({
          content: [
            {
              type: 'text',
              text: inputQuestion,
            },
            {
              type: 'image_url',
              image_url: imageBase64,
            },
          ],
        });
        */

        //const prompt = this.buildPrompt(inputQuestion, imageBase64);
        //const outputParser = new StringOutputParser();

        // Create, but don't execute, the chain
        //const chain = prompt.pipe(model).pipe(outputParser);

        // Execute the chain. We don't have any other parameters.
        //const response = await chain.invoke(inputQuestion);

        //const response = await ia.invoke([message]);

        // console.log(response.response.text());

        return resolve(this.parserResult(response));
      } catch (error) {
        console.error('Error executing as retrieval', error);
        return reject(error);
      }
    });
  }

  private async executeAsRetrieval(input: any) {
    const prompt = this.buildPromptTemplate(this.getVectorStorePrompt());

    return new Promise(async (resolve, reject) => {
      try {
        const combineDocsChain = await createStuffDocumentsChain({
          llm: this._llm,
          prompt,
        });

        const chain = await createRetrievalChain({
          retriever: this._service.asRetriever({
            verbose: true,
            k: this._settings.vectorStoreConfig?.top || 10,
            filter: this._settings.vectorStoreConfig?.customFilters
              ? interpolate<IInputProps>(
                  this._settings.vectorStoreConfig?.customFilters,
                  input
                )
              : '',
          }),
          combineDocsChain,
        });

        const response = await chain.invoke({
          verbose: true,
          input: input.question,
          question: input.question,
          history: input.history,
          ...input,
        });

        return resolve(response);
      } catch (error) {
        console.error('Error executing as retrieval', error);
        return reject(error);
      }
    });
  }

  private async buildImageGenerationChain(): Promise<
    RunnableSequence<any, any>
  > {
    const runnable = RunnableSequence.from([
      {
        user_prompt: (input) => input.user_prompt,
        user_context: (input: any) => input.user_context,
        history: (input: any) => input.history,
        images: (input: any) => input.images,
        input: (input: any) => input.question,
        question: (input: any) => input.question,
        format_chat_messages: (input) => input.format_chat_messages,
        documents: () => [], // this.executeAsRetrieval.bind(this),
      },
      {
        user_prompt: (input) => input.user_prompt,
        user_context: (input: any) => input.user_context,
        history: (input: any) => input.history,
        images: (input: any) => input.images,
        input: (input: any) => input.question,
        question: (input: any) => input.question,
        format_chat_messages: (input) => input.format_chat_messages,
        response: this.generationImages.bind(this),
      },
      {
        [this._outputKey]: (previousStepResult: any) => {
          return previousStepResult?.response || 'No image generated';
        },
      },
    ]);

    return runnable;
  }

  public async create(
    llm: BaseLanguageModel,
    ...args: any
  ): Promise<RunnableSequence<any, any>> {
    this._llm = llm;
    const imageGenerationChain = await this.buildImageGenerationChain();
    this._service = null;

    return RunnableSequence.from([
      RunnablePassthrough.assign({
        imageGenerationChain,
      }),
      RunnablePassthrough.assign({
        [this._outputKey]: (input: { imageGenerationChain: any }) => {
          return input.imageGenerationChain[this._outputKey];
        },
      }),
    ]);
  }
}

export default ImageGenrationChain;
