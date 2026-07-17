# Tasks: Restaurant Polyglot Platform

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 2,000–2,800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Eight autonomous local slices, each <400 lines; Git delivery deferred |
| Delivery strategy | local-only apply |
| Chain strategy | N/A — local-only; decide before future Git delivery |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: N/A — local-only; decide before future Git delivery
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Local slice | Notes |
|---|---|---|---|
| 1 | Tooling + health | Local 1 | Strict TDD |
| 2 | Four containers | Local 2 | Runnable |
| 3 | Mongo catalog | Local 3 | After 2 |
| 4 | Checkout/outbox | Local 4 | After 3 |
| 5 | Operator workflow | Local 5 | After 4 |
| 6 | Cassandra projection | Local 6 | After 5 |
| 7 | Web flows | Local 7 | After 6 |
| 8 | Evidence/load checks | Local 8 | After 7 |

## Phase 1: Tooling and Local Runtime

- [x] 1.1 **Unit 1:** Create `package.json`, `pnpm-workspace.yaml`, `packages/tsconfig/strict.json`, `packages/contracts/src/index.ts`, and `apps/api/{package.json,jest.config.ts,src/{main,app.module,health/health.controller}.ts,test/health.e2e-spec.ts}`; make Jest/Supertest health RED then GREEN. Update `openspec/config.yaml` and Engram testing capabilities to strict TDD.
- [ ] 1.2 **Unit 2 (RED→GREEN→REFACTOR):** Add `apps/{api,web}/Dockerfile`, `apps/web/{package.json,src/main.tsx,nginx.conf}`, `infra/{compose.yaml,mongodb/healthcheck.js}`; test **Healthy deterministic startup** and **Database delay and restart** with named volumes, internal databases, and limits.
  - Implementation and static validation pass; full Docker validation is pending because the local Docker daemon became unavailable after a read-only containerd metadata error.

## Phase 2: MongoDB Catalog and Checkout

- [ ] 2.1 **Unit 3 (RED→GREEN→REFACTOR):** Test then implement `apps/api/src/database/{mongo.provider,bootstrap.service,seed.service}.ts` and `catalog/{catalog.controller,catalog.service}.ts`; add validators/indexes, active seed, and cover **Valid schema bootstrap** and **Invalid or duplicate write**.
- [ ] 2.2 **Unit 4 (RED→GREEN→REFACTOR):** Test then implement `orders/{checkout.service,orders.controller,order.types}.ts` and contract schemas; transactionally store snapshots/order/outbox and cover **Server-calculated checkout**, **Inactive or invalid item**, **Atomic idempotent checkout**, and **Aborted transaction**.

## Phase 3: Operator and Projection Workflows

- [ ] 3.1 **Unit 5 (RED→GREEN→REFACTOR):** Add `auth/{auth.service,auth.controller,operator.guard}.ts` and `orders/transition.service.ts`; issue 15-minute secure HTTP-only cookie, protect mutations, and cover **Authenticated operator access**, **Unauthenticated or invalid access**, **Valid dispatch progression**, and **Invalid transition**.
- [ ] 3.2 **Unit 6 (RED→GREEN→REFACTOR):** Test then create `projections/{cassandra.provider,cql.bootstrap,projection.worker,projection.controller}.ts`; prepared partition reads only, lease/retry/replay both views, and cover **Supported timeline reads**, **Unsupported filtered read**, **Normal projection**, **Duplicate delivery**, and **Outage recovery**.

## Phase 4: Web and Grading Evidence

- [ ] 4.1 **Unit 7 (RED→GREEN→REFACTOR):** Implement `apps/web/src/{pages/{Catalog,Checkout,Operator}.tsx,services/api.ts,hooks/*.ts}` with public catalog/checkout and cookie-authenticated operator flows; retain API E2E tests for every public/protected boundary.
- [ ] 4.2 **Unit 8 (RED→GREEN→REFACTOR):** Create `evidence/{run.mjs,README.md}` and `apps/api/test/load/projection-load.spec.ts`; run deterministic seeds, sorted aggregation/index-hint `explain`, prepared CQL evidence, replay/restart convergence, and the **Repeatable query evidence** scenario.
