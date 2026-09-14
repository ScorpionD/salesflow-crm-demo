export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
let csrf = '';
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(method !== 'GET' ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK',
      'Connection interrupted. Your changes may have reached the server; refresh before trying again.',
    );
  }
  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The service returned an unexpected response. Please try again.',
    );
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      json.error?.code || 'REQUEST_FAILED',
      json.error?.message || 'Unable to complete this request.',
      json.error?.fields,
    );
  return json as T;
}
