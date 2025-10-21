declare module '@vercel/node' {
  import type { IncomingMessage, ServerResponse } from 'http';

  export interface VercelRequest extends IncomingMessage {
    query: Record<string, string | string[]>;
    body?: unknown;
    cookies?: Record<string, string>;
  }

  export interface VercelResponse extends ServerResponse {
    status(statusCode: number): VercelResponse;
    json(body: any): VercelResponse;
    send(body: any): VercelResponse;
    setHeader(name: string, value: string): VercelResponse;
  }
}
