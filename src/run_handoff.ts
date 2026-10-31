import { infrai } from "./infrai_audit.js";
import { handoffOrder } from "./order_handoff.js";

const result = await handoffOrder({
  jobId: "job-204",
  orderId: "order-204",
  sellerId: "seller-18",
  buyerId: "buyer-52",
  assetId: "asset-brand-kit",
  assetState: "ready",
  buyerUpdate: "Your brand kit is ready for download.",
}, {
  identifyCredential: () => infrai.account.whoami(),
  ingest: (entries, key) => infrai.logs.ingest(entries, key),
  search: (orderId) => infrai.logs.search(orderId),
});

console.log(JSON.stringify(result, null, 2));
