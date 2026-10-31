import type { HandoffRequest } from "./marketplace_order.js";
import { buildHandoffEntries, decideHandoff } from "./marketplace_order.js";

export interface AuditPort {
  identifyCredential(): Promise<unknown>;
  ingest(entries: ReturnType<typeof buildHandoffEntries>, idempotencyKey: string): Promise<unknown>;
  search(orderId: string): Promise<unknown>;
}

export async function handoffOrder(request: HandoffRequest, audit: AuditPort, now = new Date()) {
  const credential = await audit.identifyCredential();
  const entries = buildHandoffEntries(request, credential, now.toISOString());
  await audit.ingest(entries, `marketplace-handoff:${request.jobId}`);
  const matches = await audit.search(request.orderId);
  return {
    orderId: request.orderId,
    decision: decideHandoff(request),
    credential,
    loggedEvents: entries.map((entry) => entry.event),
    matches,
  };
}
