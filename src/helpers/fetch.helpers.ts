import { IConfigureTimeoutResponse, IRequest, IResponse, IResponseHeaders } from "../interface/fetch.interface";

const configureTimeout = (timeout: number): IConfigureTimeoutResponse => {
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

const tryParseJSON = (value: any) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const formatResponse = async (response: Response): Promise<IResponse> => {
  const body = tryParseJSON(await response.text());

  const responseHeaders: IResponseHeaders = {};

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

  return response.ok ? formattedResponse : { body: 'Request Error' };
}

export const fetchOpenAPI = async(data: IRequest, timeout: number, headers?: Record<string, string>): Promise<IResponse> => {
  const abortSignal = configureTimeout(timeout);

  const response = await fetch(data?.url, {
    method: data?.requestMethod,
    headers: {
      'Content-Type': data?.contentType,
      ...headers,
    },
    body: JSON.stringify(data?.data),
    signal: abortSignal.signal,
  });

  clearTimeout(abortSignal.timeoutId);

  return formatResponse(response);
}
