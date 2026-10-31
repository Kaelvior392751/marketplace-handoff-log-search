import assert from "node:assert/strict";
import test from "node:test";
import type { AuditPort } from "../src/order_handoff.js";
import { handoffOrder } from "../src/order_handoff.js";

test("a processing seller asset cannot enter buyer handoff", async () => {
  const writes: Parameters<AuditPort["ingest"]>[0][] = [];
  const audit: AuditPort = {
    identifyCredential: async () => ({ key_id: "key-test" }),
    ingest: async (entries) => { writes.push(entries); },
    search: async () => ({ results: [] }),
  };

  const result = await handoffOrder({
    jobId: "job-test",
    orderId: "order-test",
    sellerId: "seller-test",
    buyerId: "buyer-test",
    assetId: "asset-test",
    assetState: "processing",
    buyerUpdate: "This message must wait.",
  }, audit, new Date("2026-09-27T08:00:00.000Z"));

  assert.equal(result.decision, "seller_action_required");
  assert.deepEqual(result.loggedEvents, ["seller_asset_checked"]);
  assert.equal(writes[0]?.some((entry) => entry.event === "order_handed_off"), false);
  assert.deepEqual(writes[0]?.[0]?.credential, { key_id: "key-test" });
});
