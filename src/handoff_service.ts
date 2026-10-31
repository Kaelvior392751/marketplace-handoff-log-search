import { createServer } from "node:http";
import { ZodError } from "zod";
import { infrai, InfraiError } from "./infrai_audit.js";
import { handoffRequest } from "./marketplace_order.js";
import { handoffOrder } from "./order_handoff.js";

const audit = {
  identifyCredential: () => infrai.account.whoami(),
  ingest: (entries: Parameters<typeof infrai.logs.ingest>[0], key: string) => infrai.logs.ingest(entries, key),
  search: (orderId: string) => infrai.logs.search(orderId),
};

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/orders/handoff") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = handoffRequest.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await handoffOrder(input, audit);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof ZodError ? 400
      : error instanceof InfraiError && error.status >= 400 && error.status < 500 ? error.status
      : 502;
    const body = error instanceof ZodError
      ? { error: "invalid_handoff", issues: error.issues }
      : error instanceof InfraiError
        ? { error: error.code, detail: error.detail }
        : { error: "handoff_unavailable" };
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  }
});

const port = Number(process.env.PORT ?? "3000");
server.listen(port, () => console.log(`Marketplace handoff service listening on http://localhost:${port}`));
