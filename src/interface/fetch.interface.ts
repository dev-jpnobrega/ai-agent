export interface IRequest {
  url: string;
  contentType?: string;
  requestMethod?: string;
  data: object;
}

export interface IResponseHeaders {
  [key: string]: string;
}

export interface IResponse {
  body: any;
  response?: {
      body: any;
      headers: IResponseHeaders;
      ok: boolean;
      statusCode: number;
      statusText: string;
  }
}

export interface IConfigureTimeoutResponse {
  signal: AbortSignal,
  timeoutId: NodeJS.Timeout
}

