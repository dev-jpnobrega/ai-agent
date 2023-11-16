<img src="ai-agent.png" align="right" width="250" />

[![Publish new version to NPM](https://github.com/dev-jpnobrega/ai-agent/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/dev-jpnobrega/ai-agent/actions/workflows/npm-publish.yml)

# AI Agent

AI Agent simplifies the implementation and use of generative AI with LangChain, was inspired by the project [autogent](https://github.com/microsoft/autogen)



## Installation

Use the package manager [npm](https://www.npmjs.com/) to install AI Agent.

```bash
npm install ai-agent
```

## Usage

-- Simple use
```javascript
  const agent = new Agent({
      name: 'Assistent Agent',
      systemMesssage: '<a message that will specialize your agent>',
      llmConfig: {
        type: '<cloud-provider-llm-service>', // Check availability at <link>
        model: '<llm-model>',
        instance: '<instance-name>', // Optional
        apiKey: '<key-your-llm-service>', // Optional
      },
      chatConfig: {
        temperature: 0,
      }
  });

  agent.on('onMessage', async (message) => {
    console.warn('MESSAGE:', message);
  });

  await agent.call({
    question: 'What is the best way to get started with Azure?',
    chatThreadID: '<chat-id>',
  });
```


## Contributing

If you've ever wanted to contribute to open source, and a great cause, now is your chance!

See the [contributing docs](CONTRIBUTING.md) for more information

## Contributors ✨

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<table>
  <tr>
    <td align="center"><a href="https://github.com/dev-jpnobrega"><img src="https://avatars1.githubusercontent.com/u/28389807?s=400&u=2c152fc946efc96badce0cfc743ebcb2585b4b3f&v=4" width="100px;" alt=""/><br /><sub><b>JP. Nobrega</b></sub></a><br /><a href="https://github.com/dev-jpnobrega/api-rest/issues" title="Answering Questions">💬</a> <a href="https://github.com/dev-jpnobrega/api-rest/master#how-do-i-use" title="Documentation">📖</a> <a href="https://github.com/dev-jpnobrega/api-rest/pulls" title="Reviewed Pull Requests">👀</a> <a href="#talk-kentcdodds" title="Talks">📢</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

## License
[Apache-2.0](LICENSE)


