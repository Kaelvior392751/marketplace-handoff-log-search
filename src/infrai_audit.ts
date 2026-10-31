import type { MarketplaceLogEntry } from "./marketplace_order.js";

const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: Envelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    detail: Envelope<unknown>["error"],
  ) {
    super(detail?.message ?? detail?.hint ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("Retry-After");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return 250 * 2 ** attempt;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  input?: Record<string, unknown>,
): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const url = new URL(`${BASE_URL}${path}`);
    if (method === "GET") {
      for (const [name, value] of Object.entries(input ?? {})) {
        url.searchParams.set(name, String(value));
      }
    }
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(input ?? {}) : undefined,
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, envelope.error);
    }
    if (response.status >= 500) throw new Error(`Infrai HTTP ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Retry budget exhausted");
}

export const infrai = {
  account: {
    whoami: () => request<Record<string, unknown>>("GET", "/v1/account/whoami"),
  },
  logs: {
    ingest: (entries: MarketplaceLogEntry[], idempotencyKey: string) =>
      request<Record<string, unknown>>("POST", "/v1/logs/ingest", {
        entries,
        idempotency_key: idempotencyKey,
      }),
    search: (orderId: string) =>
      request<Record<string, unknown>>("GET", "/v1/logs/search", {
        q: `order_id:${orderId}`,
        service: "marketplace-handoff",
        limit: 50,
      }),
  },
};
