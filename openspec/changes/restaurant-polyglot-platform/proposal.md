# Proposal: Restaurant Polyglot Platform

## Intent

Deliver a bounded university restaurant platform that demonstrates defensible MongoDB operational modeling and a minimal Cassandra projection, rather than duplicating CRUD across databases.

## Scope

### In Scope
- Restaurant catalog, guest checkout with server-calculated totals, and an order-state/dispatch workflow.
- MongoDB as the operational source of truth: validation, indexes, aggregations, multi-document transactions, `explain`, and a transactional outbox.
- Cassandra projections with exactly `order_timeline_by_order` and `restaurant_activity_by_day`; an embedded API polling worker writes idempotently.
- Local Docker Compose profile with four persistent containers and reproducible database-focused grading evidence.

### Out of Scope
- PostgreSQL, Redis, Kafka, database GUIs, permanent metrics, payments, WhatsApp, coupons, reviews, and HA/scalable Cassandra claims.
- More Cassandra views, bidirectional synchronization, production deployment hardening, and remote Git delivery.

## Capabilities

### New Capabilities
- `restaurant-order-workflow`: Catalog, checkout, calculated totals, and valid order/dispatch transitions.
- `mongodb-operational-store`: MongoDB schemas, validation, indexes, transactions, aggregation, outbox, and query-plan evidence.
- `cassandra-activity-projections`: Idempotent event projection and the two query-first Cassandra views.
- `polyglot-local-runtime`: Four-container local Compose topology, resource limits, seeds, and demonstrable recovery.

### Modified Capabilities
None — no baseline specifications exist.

## Approach

NestJS API owns writes and runs the outbox poller in-process. A one-member MongoDB replica set (1.5 GB) commits operational changes and outbox records transactionally; the worker projects at least once to one Cassandra node (3 GB). Web (96 MB) and API+worker (384 MB) complete the approximately 5 GB experimental profile. Cassandra is eventually consistent and academic-only.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `apps/web` | New | Restaurant and operations UI. |
| `apps/api` | New | NestJS workflows, MongoDB, and embedded worker. |
| `packages/contracts` | New | Shared request and event schemas. |
| `infra/compose.yaml` | New | Four-container runtime and limits. |
| `evidence/` | New | Repeatable database grading artifacts. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cassandra instability at 3 GB | Medium | Soak-test; raise only Cassandra to 4 GB if required. |
| Projection lag/failure | Medium | Idempotency, replay, and visible projection status. |

## Rollback Plan

Stop the worker and revert the API/web deployment; preserve MongoDB volumes. Cassandra projections can be dropped and replayed from MongoDB outbox records after a fixed build.

## Dependencies

- Docker Compose with the experimental memory budget; MongoDB replica-set initialization.
- Local-first delivery only; future work units must stay within the 400-line review budget.

## Success Criteria

- [ ] Compose runs exactly four persistent containers within an approximately 5 GB budget.
- [ ] A checkout transaction commits an order and outbox event atomically in MongoDB.
- [ ] `explain`, validation, indexes, transactions, and aggregations have reproducible evidence.
- [ ] Each event appears idempotently in both Cassandra views after replay/recovery.

## Proposal Question Round

Assumptions for review: guest checkout is sufficient for the first slice; complaints are deferred; grading prioritizes database evidence over UI polish. Confirm or correct these before specs.
