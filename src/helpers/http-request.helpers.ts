class FetchRequestError extends Error {
  public code: any;
  public originalStack: any;

  constructor(originalError: any) {
    const detailedError = originalError.cause
      ? originalError.cause
      : originalError;

    let { message, code } = detailedError;

    if (originalError.name === 'AbortError') {
      message = 'Request timeout';
      code = 'ETIMEDOUT';
    }

    super(message);

    this.name = detailedError.name;
    this.code = code;
    this.originalStack = detailedError.stack;
  }
}

function tryParseJSON(value: any) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function configureTimeout({ timeout }: any) {
  let timeoutId = null;
  const controller = new AbortController();
  const { signal } = controller;

  if (timeout) {
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);
  }

  return { signal, timeoutId };
}

async function formatResponse(response: Response, returnStream: any) {
  const body = returnStream
    ? response.body
    : tryParseJSON(await response.text());

  const responseHeaders = {} as any;

  Array.from(response.headers.keys()).forEach((key) => {
    responseHeaders[key] = response.headers.get(key);
  });

  const formattedResponse = {
    body,
    response: {
      body,
      headers: responseHeaders,
      ok: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
    },
  };

  return response.ok ? formattedResponse : Promise.reject(formattedResponse);
}

async function fetchRequest(options = {} as any, returnStream = false) {
  try {
    const abortSignal = configureTimeout(options);

    const reqHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(options.url, {
      ...options,
      body: JSON.stringify(options.body),
      headers: reqHeaders,
      signal: abortSignal.signal,
    });

    clearTimeout(abortSignal.timeoutId);

    return formatResponse(response, returnStream);
  } catch (error) {
    const fetchRequestError = new FetchRequestError(error);
    throw fetchRequestError;
  }
}

export default fetchRequest;
