# Design: Restaurant Polyglot Platform

## Technical Approach

The repository intentionally has no application or test conventions. These are **adopted template patterns**, verified through Graphify then source reads, not existing project patterns: pnpm workspaces, Nest modules, shared Zod validation, cookie JWT guards, React Router/Query/Axios, and multi-stage Node/nginx images. TypeORM, PostgreSQL, Google auth, and registration are excluded.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Native `mongodb` / Mongoose | Less Nest sugar / direct transactions, validators, indexes, explain | Native driver behind provider tokens avoids ODM translation. |
| Apache `cassandra-driver` / ORM | Manual CQL / prepared UUID/date binding | The npm package and options are verified against official `/apache/cassandra-nodejs-driver` docs; no ORM is justified. |
| UUID / `ObjectId` | Larger Mongo keys / cross-store identity | Generate canonical UUIDv4 strings; bind with `types.Uuid.fromString`. |
| Embedded poller / broker | Single-instance throughput / no extra service | Lease inside API; no Kafka or fifth container. |
| Static operator / users collection | One operator / smallest write protection | `OPERATOR_PASSWORD_HASH` plus a 15-minute HS256 cookie (`HttpOnly; Secure; SameSite=Strict; Path=/`) reuse the template guard; no refresh or registration. |

## Data Flow

```text
Browser -> nginx web -> Nest API -> MongoDB replica set
                              ^          | order + outbox transaction
                              `- poller -+-> Cassandra two-view projection
```

## Storage and Contracts

Bootstrap creates or `collMod`s strict `$jsonSchema` validators (`validationAction:error`; required fields; no extras): UUIDs are canonical strings, money/quantities BSON integers, timestamps dates, flags booleans, and nested shapes exact. Named indexes are:

| Mongo collection | Boundary | Indexes |
|---|---|---|
| `catalog_items` | `_id`, `restaurantId`, `sku`, `name`, `priceCents:int>=0`, `active`, timestamps | unique `uq_catalog_restaurant_sku` `{restaurantId:1,sku:1}` |
| `orders` | `guest:{name,phone,address}`; snapshots `{catalogItemId,sku,name,unitPriceCents,quantity,lineTotalCents}`; `totalCents:int`; status `PENDING|CONFIRMED|PREPARING|READY|DISPATCHED|DELIVERED|CANCELLED`; history `{eventId,status,at}`; idempotency/hash/timestamps | unique `uq_orders_idempotency`; `ix_orders_restaurant_createdAt` `{restaurantId:1,createdAt:-1}` |
| `outbox` | IDs; type `ORDER_CREATED|ORDER_STATUS_CHANGED`; payload `{status,totalCents}`; occurrence; status `PENDING|PROCESSING|PROCESSED`; attempts; dated lease/retry/result; nullable error | unique `uq_outbox_eventId`; `ix_outbox_claim` `{processedAt:1,nextAttemptAt:1,leaseUntil:1,createdAt:1}` |

Checkout precomputes IDs/time/hash; `withTransaction` inserts order and event with majority writes and reuses those values on callback retry. Duplicate idempotency returns the original; a different hash returns 409. Transitions filter current status and transactionally update history plus outbox; races change nothing.

```cql
CREATE KEYSPACE IF NOT EXISTS restaurant_projection
 WITH replication = {'class':'NetworkTopologyStrategy','datacenter1':1};
USE restaurant_projection;
CREATE TABLE IF NOT EXISTS order_timeline_by_order (
 order_id uuid, occurred_at timestamp, event_id uuid, restaurant_id uuid,
 event_type text, order_status text, total_cents int,
 PRIMARY KEY ((order_id), occurred_at, event_id)
) WITH CLUSTERING ORDER BY (occurred_at ASC, event_id ASC);
CREATE TABLE IF NOT EXISTS restaurant_activity_by_day (
 restaurant_id uuid, day date, occurred_at timestamp, event_id uuid, order_id uuid,
 event_type text, order_status text, total_cents int,
 PRIMARY KEY ((restaurant_id, day), occurred_at, event_id)
) WITH CLUSTERING ORDER BY (occurred_at DESC, event_id ASC);
```

Prepared reads require `order_id=?` or `(restaurant_id=?,day=?)`; `ALLOW FILTERING` is never issued.

## Polling, Interfaces, and Evidence

Every 2s, the poller leases the oldest eligible event for 30s, upserts both tables, then conditionally marks it processed. Failure releases it and retries indefinitely after `min(2^attempts,60s)`. Crashes replay identical keys. Protected status returns counts, oldest lag, attempts, and last error; replay resets selected events.

Public API: catalog reads and `POST /api/orders` (`Idempotency-Key`) only. Credential login returns the operator cookie or a generic 401. Catalog mutations, order transitions, projection status/replay, and both Cassandra partition reads require that session; unauthenticated requests return 401 before data access.

`evidence/run.mjs` uses fixed UUIDs/dates/keys. It emits sorted aggregation totals and the stable index-name/count subset of `find({restaurantId,createdAt range}).sort(...).hint('ix_orders_restaurant_createdAt').explain('executionStats')`, excluding timings, plus both prepared CQL partition queries.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `pnpm-workspace.yaml`, `packages/{tsconfig,contracts}/**` | Create | Workspace and contracts. |
| `apps/api/src/{database,catalog,orders,auth,projections,health}/**` | Create | Nest clients, bootstrap, workflows, poller. |
| `apps/web/src/{pages,hooks,services,lib}/**` | Create | Guest/operator web. |
| `apps/{api,web}/Dockerfile`, `apps/web/nginx.conf` | Create | Images and API proxy. |
| `infra/compose.yaml`, `infra/mongodb/healthcheck.js` | Create | Runtime and replica-set initialization. |
| `apps/api/{jest.config.ts,test/**}`, `**/*.spec.ts` | Create | Unit/integration/E2E foundation. |
| `evidence/run.mjs` | Create | Deterministic evidence. |

## Testing Strategy

| Layer | Approach |
|---|---|
| Unit | Jest: totals, transitions, auth, claim/backoff with fakes. |
| Integration | Jest on Compose network: validators/indexes, abort/idempotency, prepared replay. |
| E2E | `@nestjs/testing` + Supertest: public boundary, auth, transitions, status, protected partition reads. |

Tooling is slice one; strict TDD can then be enabled.

## Migration / Rollout

No migration. API entrypoint idempotently bootstraps schemas and fixed seed. Compose health-gates Mongo replica-set primary, Cassandra, API, then web. Exactly four persistent services run: web 96 MiB, API+poller 384 MiB, MongoDB 1536 MiB, Cassandra 3072 MiB. Only web publishes a port; databases use an internal network and named `mongodb_data`/`cassandra_data` volumes. Classroom inspection remains available with `docker compose exec mongodb mongosh` and `docker compose exec cassandra cqlsh`. Images are multi-stage; all services use restart policies and `json-file` rotation (`10m`, three files).

## Open Questions

None.
