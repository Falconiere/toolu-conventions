/** The house HTTP client — GET/POST/PUT/PATCH/DELETE over the Web `fetch` API. */

// No axios. `fetch` is built into every runtime this kit targets (browser,
// Cloudflare Workers, Bun, React Native), so a small wrapper beats a dependency
// we would have to keep, bundle, and patch. Cross-cutting behaviour (auth
// headers, base URL, timeout) is configured once in `createHttpClient` — never
// re-implemented at a call site.
//
// Responses come back as `unknown` unless you pass a `parse` function. That is
// the house rule made structural: the only way to get a typed body out of this
// client is to hand it something that actually validates one. In practice that
// something is a Zod schema:
//
//   const shifts = await http.get('/shifts', { parse: (body) => ShiftList.parse(body) });
//
// Wrap the call in an arrow function rather than passing `ShiftList.parse`
// directly — an unbound method loses its `this`.

/** Query values accepted on a request; `undefined` entries are dropped. */
export type HttpQuery = Readonly<Record<string, string | number | boolean | undefined>>;

/**
 * Turns an unknown response body into `T` — throws if the shape is wrong.
 * A Zod schema's `.parse` has exactly this signature; call it from an arrow
 * function so the method keeps its `this`.
 */
export type HttpParser<T> = (body: unknown) => T;

/** Per-request options. */
export interface HttpOptions {
  readonly query?: HttpQuery;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

/** Per-request options carrying a parser — the typed-response variant. */
export interface ParsedHttpOptions<T> extends HttpOptions {
  readonly parse: HttpParser<T>;
}

/** How a client is built: where it points and what it sends on every request. */
export interface HttpClientConfig {
  /** Absolute base URL every path is resolved against. */
  readonly baseUrl: string;
  /** Abort budget for a single request. Default: 8000ms. */
  readonly timeoutMs?: number;
  /** Resolved before each request — the place for auth/tracing headers. */
  readonly headers?: () => Promise<Record<string, string>> | Record<string, string>;
}

/** One method per verb. Pass `parse` to get a typed body instead of `unknown`. */
export interface HttpClient {
  get(path: string, options?: HttpOptions): Promise<unknown>;
  get<T>(path: string, options: ParsedHttpOptions<T>): Promise<T>;
  delete(path: string, options?: HttpOptions): Promise<unknown>;
  delete<T>(path: string, options: ParsedHttpOptions<T>): Promise<T>;
  post(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  post<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  put(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  put<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  patch(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  patch<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
}

/** Thrown for every non-2xx response; carries the status and the decoded body. */
export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(status: number, url: string, body: unknown) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/** Thrown when a request exceeds its timeout budget or its signal aborts. */
export class HttpAbortError extends Error {
  readonly url: string;

  constructor(url: string, timedOut: boolean) {
    super(timedOut ? `HTTP request timed out: ${url}` : `HTTP request aborted: ${url}`);
    this.name = 'HttpAbortError';
    this.url = url;
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;

// `JSON.parse` retyped to hand back `unknown`. Assigning the *function* (not its
// result) keeps `any` from ever entering the module.
const parseJson: (text: string) => unknown = JSON.parse;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function buildUrl(baseUrl: string, path: string, query: HttpQuery | undefined): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(path.replace(/^\/+/, ''), base);
  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function decode(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('json') ? parseJson(text) : text;
}

/** Builds a client bound to one base URL. Export one instance per API, not per call. */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  async function send(
    method: HttpMethod,
    path: string,
    body: unknown,
    options: HttpOptions | undefined,
  ): Promise<unknown> {
    const url = buildUrl(config.baseUrl, path, options?.query);
    const timeoutMs = options?.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // A manual controller (rather than `AbortSignal.timeout`/`any`) keeps this
    // file working on React Native's Hermes runtime, which lacks both.
    const controller = new AbortController();
    let timedOut = false;
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const forwardAbort = (): void => {
      controller.abort();
    };
    options?.signal?.addEventListener('abort', forwardAbort);

    const headers: Record<string, string> = { accept: 'application/json' };
    const configured = await config.headers?.();
    if (configured !== undefined) {
      Object.assign(headers, configured);
    }
    if (options?.headers !== undefined) {
      Object.assign(headers, options.headers);
    }

    let payload: string | undefined;
    if (body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      headers['content-type'] ??= 'application/json';
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
        ...(payload === undefined ? {} : { body: payload }),
      });
      const decoded = await decode(response);
      if (!response.ok) {
        throw new HttpError(response.status, url, decoded);
      }
      return decoded;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new HttpAbortError(url, timedOut);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      options?.signal?.removeEventListener('abort', forwardAbort);
    }
  }

  async function run(
    method: HttpMethod,
    path: string,
    body: unknown,
    options: HttpOptions | undefined,
  ): Promise<unknown> {
    const decoded = await send(method, path, body, options);
    const parse = options === undefined ? undefined : readParser(options);
    return parse === undefined ? decoded : parse(decoded);
  }

  function get(path: string, options?: HttpOptions): Promise<unknown>;
  function get<T>(path: string, options: ParsedHttpOptions<T>): Promise<T>;
  function get(path: string, options?: HttpOptions): Promise<unknown> {
    return run('GET', path, undefined, options);
  }

  function del(path: string, options?: HttpOptions): Promise<unknown>;
  function del<T>(path: string, options: ParsedHttpOptions<T>): Promise<T>;
  function del(path: string, options?: HttpOptions): Promise<unknown> {
    return run('DELETE', path, undefined, options);
  }

  function post(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  function post<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  function post(path: string, body?: unknown, options?: HttpOptions): Promise<unknown> {
    return run('POST', path, body, options);
  }

  function put(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  function put<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  function put(path: string, body?: unknown, options?: HttpOptions): Promise<unknown> {
    return run('PUT', path, body, options);
  }

  function patch(path: string, body?: unknown, options?: HttpOptions): Promise<unknown>;
  function patch<T>(path: string, body: unknown, options: ParsedHttpOptions<T>): Promise<T>;
  function patch(path: string, body?: unknown, options?: HttpOptions): Promise<unknown> {
    return run('PATCH', path, body, options);
  }

  return { get, delete: del, post, put, patch };
}

/** Reads the optional `parse` guard off an options bag without asserting a type. */
function readParser(
  options: HttpOptions | ParsedHttpOptions<unknown>,
): HttpParser<unknown> | undefined {
  return 'parse' in options ? options.parse : undefined;
}
