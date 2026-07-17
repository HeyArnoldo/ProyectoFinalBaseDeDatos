# Proposal: Restaurant Polyglot Platform

## Intent

Deliver a bounded university restaurant platform that pairs a polished restaurant experience with defensible MongoDB modeling and a minimal Cassandra projection.

## Scope

### In Scope
- Catalog, guest checkout, server-calculated totals, and order/dispatch workflow.
- MongoDB source of truth: validation, indexes, aggregations, transactions, `explain`, and transactional outbox.
- Embedded worker projects exactly `order_timeline_by_order` and `restaurant_activity_by_day` idempotently.
- Mobile-first neutral-Spanish UI with contemporary Peruvian visual language, public/operator flows, accessibility, and visible projection state.
- Deterministic ~12-product categorized catalog with active/inactive data, image URLs, and local fallback.
- Four-container local Compose profile and reproducible database evidence.

### Out of Scope
- PostgreSQL, Redis, Kafka, database GUIs, permanent metrics, payments, WhatsApp, coupons, reviews, and HA/scalable Cassandra claims.
- Extra Cassandra views, bidirectional sync, production hardening, and remote Git delivery.

## Capabilities

### New Capabilities
- `restaurant-order-workflow`: Catalog, checkout, totals, and valid order/dispatch transitions.
- `mongodb-operational-store`: Schemas, validation, indexes, transactions, aggregation, outbox, and `explain` evidence.
- `cassandra-activity-projections`: Idempotent projection into the two query-first views.
- `polyglot-local-runtime`: Four-container Compose topology, limits, seeds, and recovery.
- `restaurant-web-experience`: Presentation-ready mobile public catalog/filter/cart/checkout and operator views; Spanish, accessibility/states, deterministic catalog/fallback, UUID and projection status/lag.

### Modified Capabilities
None — no baseline specifications exist.

## Approach

NestJS owns writes and the in-process poller. A one-member MongoDB replica set (1.5 GB) commits operations and outbox records transactionally; at-least-once projection targets one Cassandra node (3 GB). Web stays within 96 MiB; API+worker is 384 MB. Cassandra is eventual and academic-only.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `apps/web` | New | Public/operator UI, accessibility, assets. |
| `apps/api` | New | Workflows, MongoDB, embedded worker. |
| `packages/contracts` | New | Requests and events. |
| `infra/compose.yaml` | New | Four-container limits. |
| `evidence/` | New | Database and UI evidence. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cassandra instability at 3 GB | Medium | Soak-test; increase only Cassandra to 4 GB if needed. |
| Projection lag/failure | Medium | Idempotency, replay, visible status. |
| Assets exceed web budget | Medium | Optimize; remote URL plus local fallback. |

## Rollback Plan

Stop worker and revert API/web; preserve MongoDB volumes. Drop and replay Cassandra projections from the MongoDB outbox after a fixed build.

## Dependencies

- Compose budget and MongoDB replica-set initialization.
- Local-first; future work units stay within 400 review lines.

## Success Criteria

- [ ] Exactly four containers run within approximately 5 GB.
- [ ] Checkout atomically commits MongoDB order and outbox event.
- [ ] Mongo validation, indexes, transactions, aggregations, and `explain` have reproducible evidence.
- [ ] Each event reaches both Cassandra views after replay/recovery.
- [ ] Mobile and desktop users filter a deterministic ~12-product catalog, manage cart, complete validated guest checkout, and see UUID plus projection status/lag.
- [ ] Signed-in operators use responsive order/projection views; keyboard, focus, contrast, semantic, loading, empty, and error behavior are verified.
