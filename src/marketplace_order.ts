import { z } from "zod";

export const handoffRequest = z.object({
  jobId: z.string().min(1),
  orderId: z.string().min(1),
  sellerId: z.string().min(1),
  buyerId: z.string().min(1),
  assetId: z.string().min(1),
  assetState: z.enum(["ready", "processing"]),
  buyerUpdate: z.string().min(1).max(500),
});

export type HandoffRequest = z.infer<typeof handoffRequest>;
export type HandoffDecision = "handed_off" | "seller_action_required";

export type MarketplaceLogEntry = {
  timestamp: string;
  level: "info" | "warn";
  message: string;
  service: "marketplace-handoff";
  environment: string;
  trace_id: string;
  order_id: string;
  seller_id: string;
  buyer_id: string;
  asset_id: string;
  event: "seller_asset_checked" | "buyer_updated" | "order_handed_off";
  decision: HandoffDecision;
  credential: unknown;
};

export function decideHandoff(request: HandoffRequest): HandoffDecision {
  return request.assetState === "ready" ? "handed_off" : "seller_action_required";
}

export function buildHandoffEntries(
  request: HandoffRequest,
  credential: unknown,
  timestamp: string,
  environment = "development",
): MarketplaceLogEntry[] {
  const decision = decideHandoff(request);
  const event = (name: MarketplaceLogEntry["event"], message: string): MarketplaceLogEntry => ({
    timestamp,
    level: decision === "handed_off" ? "info" : "warn",
    message,
    service: "marketplace-handoff",
    environment,
    trace_id: request.jobId,
    order_id: request.orderId,
    seller_id: request.sellerId,
    buyer_id: request.buyerId,
    asset_id: request.assetId,
    event: name,
    decision,
    credential,
  });

  const entries = [event("seller_asset_checked", `Seller asset is ${request.assetState}`)];
  if (decision === "seller_action_required") return entries;
  entries.push(event("buyer_updated", request.buyerUpdate));
  entries.push(event("order_handed_off", "Order passed to buyer delivery"));
  return entries;
}
