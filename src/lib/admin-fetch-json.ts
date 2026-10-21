/**
 * JSON helpers for the admin dashboards.
 *
 * The admin APIs always answer with JSON, but the proxy in front of them does
 * not: during a container swap nginx answers `502` with its own HTML page, and
 * `response.json()` then surfaces as `Unexpected token '<', "<!DOCTYPE "... is
 * not valid JSON` in the dashboard. These helpers turn such answers into a
 * readable message and retry idempotent reads across that gap.
 */

export type JsonBody = Record<string, unknown>;

const GATEWAY_STATUSES = new Set([502, 503, 504]);

export function isGatewayStatus(status: number): boolean {
  return GATEWAY_STATUSES.has(status);
}

export function describeHttpFailure(status: number, statusText?: string): string {
  if (status === 502 || status === 503) return "The server is restarting. Try again in a few seconds.";
  if (status === 504) return "The server took too long to answer. Try again.";
  if (status === 401) return "Your admin session has expired. Sign in again.";
  if (status === 403) return "This request was refused.";
  if (status === 413) return "The request was too large.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status >= 500) return `The server failed with status ${status}.`;
  const suffix = statusText ? ` ${statusText}` : "";
  return `Request failed with status ${status}${suffix}.`.replace(/\s+\./, ".");
}

/**
 * Parse a response body that should be JSON. A non-JSON body never throws a
 * parser error; it yields `{ ok: false, error }` describing the HTTP status,
 * so callers can keep their `body.ok` / `body.error` conventions.
 */
export async function readJsonBody(response: Response): Promise<JsonBody> {
  const text = await response.text().catch(() => "");
  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as JsonBody;
      return { ok: response.ok, data: parsed };
    } catch {
      // HTML error page or truncated body. Fall through to a status message.
    }
  }
  if (response.ok && !text.trim()) return { ok: true };
  return { ok: false, error: describeHttpFailure(response.status, response.statusText) };
}

export type FetchJsonOptions = {
  /** Retries for gateway errors (502/503/504) and network failures. Only for idempotent requests. */
  retries?: number;
  /** Delay before each retry, in ms. */
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export type JsonResult = { response: Response; body: JsonBody };

/**
 * `fetch` + `readJsonBody`, retrying idempotent requests across a short
 * outage. Returns the final response and its parsed body; it never throws
 * for a non-JSON body. A network failure after the last retry rethrows.
 */
export async function fetchJson(input: string, init?: RequestInit, options: FetchJsonOptions = {}): Promise<JsonResult> {
  const method = (init?.method ?? "GET").toUpperCase();
  const idempotent = method === "GET" || method === "HEAD";
  const retries = idempotent ? (options.retries ?? 2) : 0;
  const delay = options.retryDelayMs ?? 1500;
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let attempt = 0;
  for (;;) {
    try {
      const response = await doFetch(input, init);
      if (isGatewayStatus(response.status) && attempt < retries) {
        attempt += 1;
        await sleep(delay * attempt);
        continue;
      }
      const body = await readJsonBody(response);
      return { response, body };
    } catch (caught) {
      if (attempt < retries) {
        attempt += 1;
        await sleep(delay * attempt);
        continue;
      }
      throw caught;
    }
  }
}

export function errorFromBody(body: JsonBody, fallback: string): string {
  return typeof body.error === "string" && body.error ? body.error : fallback;
}
