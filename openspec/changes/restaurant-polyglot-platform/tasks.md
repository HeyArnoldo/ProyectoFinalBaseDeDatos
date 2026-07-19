# Tasks: Restaurant Polyglot Platform

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 3,600–4,400 total |
| 400-line budget risk | High |
| Chained PRs recommended | Yes — future delivery only |
| Suggested split | Ten local slices; five complete, five remaining <400 lines |
| Delivery strategy | local-only apply; no Git operations |
| Chain strategy | N/A — local-only; decide before future Git delivery |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: N/A — local-only; decide before future Git delivery
400-line budget risk: High

### Suggested Work Units

| Slice | Scope | Status |
|---|---|---|
| 1–4 | Tooling, runtime, Mongo catalog, checkout | Complete |
| 5 | Operator authentication and order transitions | Complete |
| 6 | Cassandra projection | Pending |
| 7 | Catalog data + UI test/style foundation | Pending |
| 8 | Public catalog/checkout | Pending |
| 9 | Operator web | Pending |
| 10 | UI/database evidence | Pending |

## Phase 1: Tooling and Local Runtime

- [x] 1.1 **Unit 1:** Create `package.json`, `pnpm-workspace.yaml`, `packages/tsconfig/strict.json`, `packages/contracts/src/index.ts`, and `apps/api/{package.json,jest.config.ts,src/{main,app.module,health/health.controller}.ts,test/health.e2e-spec.ts}`; make Jest/Supertest health RED then GREEN. Update `openspec/config.yaml` and Engram testing capabilities to strict TDD.
- [x] 1.2 **Unit 2 (RED→GREEN→REFACTOR):** Add `apps/{api,web}/Dockerfile`, `apps/web/{package.json,src/main.tsx,nginx.conf}`, `infra/{compose.yaml,mongodb/healthcheck.js}`; test **Healthy deterministic startup** and **Database delay and restart** with named volumes, internal databases, and limits.
  - Full Docker build, health-gated startup, database queries, restart persistence, resource capture, and volume-preserving shutdown verified.

## Phase 2: MongoDB Catalog and Checkout

- [x] 2.1 **Unit 3 (RED→GREEN→REFACTOR):** Test then implement `apps/api/src/database/{mongo.provider,bootstrap.service,seed.service}.ts` and `catalog/{catalog.controller,catalog.service}.ts`; add validators/indexes, active seed, and cover **Valid schema bootstrap** and **Invalid or duplicate write**.
  - Verified native Mongo lifecycle, strict validators, named indexes, invalid/duplicate rejection, deterministic reseeding, and public active-only catalog reads through the four-container stack.
  - Audit remediation verified canonical lowercase UUIDv4 validators, fail-fast Mongo configuration, shared Zod response parsing, exact index and `$setOnInsert` assertions, client shutdown, and automated Docker black-box enforcement.
- [x] 2.2 **Unit 4 (RED→GREEN→REFACTOR):** Test `apps/api/src/orders/{checkout.service,orders.controller,order.types}.ts` and contracts; atomically store snapshots/order/outbox for **Server-calculated checkout**, invalid items, idempotency, and abort.
  - Verified server-priced immutable snapshots, canonical UUIDv4 IDs, validation of unavailable/invalid items, forged-total rejection by omission, sequential and concurrent duplicate-key idempotency recovery, mismatch conflicts, transaction abort handling, and one pending outbox event in the same transaction; real Mongo transaction evidence was unavailable because Docker Desktop was not running.

## Phase 3: Operator and Projection Workflows

- [x] 3.1 **Unit 5 (RED→GREEN→REFACTOR):** Test `auth/{auth.service,auth.controller,operator.guard}.ts` and `orders/transition.service.ts`; secure cookie/protected transitions for authenticated, unauthenticated, valid, and invalid-transition scenarios.
  - Verified bcrypt-backed static login, 15-minute HS256 session cookie, absent/invalid/expired guard rejection, forward/cancel transition rules, expected-state atomic update, history append, status outbox, and no writes for invalid/stale transitions.
  - Security remediation verified required non-empty `OPERATOR_USERNAME`, `OPERATOR_PASSWORD_HASH`, and `JWT_SECRET` configuration plus mandatory Compose interpolation without repository secrets.
  - Native Mongo transaction evidence remains unavailable; focused Unit 5 tests use session mocks only and do not claim real Mongo evidence.
- [ ] 3.2 **Unit 6 (RED→GREEN→REFACTOR):** Test `projections/{cassandra.provider,cql.bootstrap,projection.worker,projection.controller}.ts`; prepared reads, lease/replay, duplicate, outage, and status scenarios without `ALLOW FILTERING`.

## Phase 4: Public Web Experience

- [ ] 4.1 **Unit 7 (RED→GREEN→REFACTOR):** Test `database/{bootstrap,seed}.service.ts`, `catalog.service.ts`, and `packages/contracts/src/catalog.ts`; add category/description/nullable image URL, fixed-ID-only seed migration, ~12 categorized products/fallback. Configure Tailwind v4, Vitest, and Testing Library in `apps/web/{package.json,vite.config.ts,vitest.config.ts,src/{styles.css,test/setup.ts}}`.
- [ ] 4.2 **Unit 8 (RED→GREEN→REFACTOR):** Test then add `apps/web/src/{app/{router,providers}.tsx,features/{catalog,cart,checkout}/**}`; Spanish responsive filter/cart/checkout/confirmation and accessible empty, offline, error, and fallback states for **Desktop checkout** and **Mobile unavailable catalog**.

## Phase 5: Operator Web and Evidence

- [ ] 5.1 **Unit 9 (RED→GREEN→REFACTOR):** Test then add `apps/web/src/{features/{auth,operator}/**,layouts/OperatorLayout.tsx}`; lazy protected login/orders/projection boards for **Accessible operator board** and **Unauthorized operator view**.
- [ ] 5.2 **Unit 10 (RED→GREEN→REFACTOR):** Add `apps/web/{playwright.config.ts,src/test/**}`, `evidence/{ui/**,run.mjs}`, and `apps/api/test/load/projection-load.spec.ts`; capture Playwright responsive/a11y plus deterministic Mongo/Cassandra/replay/load evidence.
