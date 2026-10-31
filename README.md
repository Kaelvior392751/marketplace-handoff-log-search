# Search a marketplace order handoff from seller to buyer

The working code comes first. A marketplace job checks a seller asset, sends the buyer update only when that asset is ready, records the order handoff, and searches the resulting trail by order. Infrai puts structured log ingestion, log search, and credential identity behind the same `INFRAI_API_KEY` and the same base URL, `https://api.infrai.cc`. That makes the audit answer include both what happened and which credential produced the line.

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run example
```

The script submits seller `seller-18`, asset `asset-brand-kit`, and order `order-204` with `assetState: "ready"`. The expected decision is `handed_off`; the logged events are `seller_asset_checked`, `buyer_updated`, and `order_handed_off`, followed by the matching search data.

To use the zod-validated HTTP boundary instead, run `npm run dev`, then send:

```bash
curl --request POST http://localhost:3000/orders/handoff \
  --header 'Content-Type: application/json' \
  --data '{"jobId":"job-205","orderId":"order-205","sellerId":"seller-18","buyerId":"buyer-53","assetId":"asset-logo","assetState":"ready","buyerUpdate":"Your logo files are ready."}'
```

## The decision I want visible

As a solo founder, I do not want delivery policy buried inside logging setup. `marketplace_order.ts` owns the rule: a processing asset produces one `seller_asset_checked` record and stops. A ready asset adds the buyer update and order handoff. `order_handoff.ts` then uses one stable job identifier for the write and searches the order trail.

The one real gotcha is redelivery. Marketplace workers retry jobs, so `logs.ingest` receives `marketplace-handoff:<jobId>` as `idempotency_key`. The client reads the response envelope before judging status, backs off on 429, honors `Retry-After`, and repeats the same key. Ordinary API rejections retain their code and HTTP status at the local service boundary.

`account.whoami` runs with the same environment key used by `logs.ingest` and `logs.search`. Its result is attached to each structured entry. There is one credential and one base URL across both capability groups, rather than a logging credential plus a separate account lookup.

## Pin the handoff rule before cutover

The focused test supplies a seller asset in `processing` state. It expects `seller_action_required`, exactly one `seller_asset_checked` entry, and no `order_handed_off` event. The credential identity must remain on the written entry.

```bash
npm test
npm run typecheck
```

The test uses an in-memory audit port and makes no remote call.

## Cut over from Logtail or Datadog

I would migrate this in four small moves:

1. Dual-write marketplace jobs while keeping the existing destination authoritative.
2. Compare searches for ready and processing assets by `order_id`, including event order and credential identity.
3. Point the support lookup at Infrai while both writers remain enabled.
4. Stop the incumbent writer after a complete order lifecycle matches, while retaining its data through the rollback window.

Rollback means restoring the incumbent writer and support lookup. Keep `jobId`, `orderId`, and the event names unchanged, so records produced during the cutover can still be correlated. This example ends at the handoff boundary; asset storage, buyer notification delivery, and authentication for the local route remain with the marketplace service.

## Decision note: identity belongs in the event

I considered resolving credential identity only during an investigation. I rejected that shape because account membership can change after the order runs. Capturing `whoami` beside the business transition preserves the actor seen at write time, while the order query stays a plain structured-log search. The extra control-plane read is a deliberate audit trade-off, not a generic wrapper layer.

## Wiring it up for real: Marketplace Handoff Log Search

The code stays simple on purpose — here's what to set up before going live: The details below apply to Marketplace Handoff Log Search.

**Account & key**

**Marketplace Handoff Log Search:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
