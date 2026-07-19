## Verification Report

**Change**: `restaurant-polyglot-platform`
**Work unit**: Unit 5 / task 3.1 only
**Version**: N/A
**Mode**: Strict TDD, partial work-unit verification
**Date**: 2026-07-18

> **Current state**: Re-verification after the authentication-configuration security remediation is appended below. The original verification remains intact as historical evidence.

### Verdict

**PASS WITH WARNINGS**

Unit 5 is complete at source and mock-backed runtime level. The focused suite, full suite, typecheck, build, and `git diff --check` all passed. The principal evidence limitation is that the Mongo transition tests use a fake session and collections, so they do not prove real replica-set transaction atomicity.

### Scope and Completeness

| Metric | Value |
|---|---:|
| Target tasks | 1 |
| Target tasks complete | 1 |
| Target tasks incomplete | 0 |
| Whole-change tasks complete | 5/10 |
| Later tasks intentionally pending | 5 (`3.2`, `4.1`, `4.2`, `5.1`, `5.2`) |

Prior Units 1–4 were treated as a passing baseline and were not independently re-verified. Later tasks are remaining change work, not Unit 5 defects.

### Build and Test Execution

| Command | Result | Runtime evidence |
|---|---|---|
| `pnpm --filter @app/contracts run build; pnpm --filter @app/api exec jest --config jest.config.ts --runInBand test/auth-transition.e2e-spec.ts` | ✅ Exit 0 | 1 suite, 8/8 tests passed in 8.084 s |
| `pnpm test` | ✅ Exit 0 | 5 suites, 32/32 tests passed in 11.844 s |
| Corrected auxiliary Supertest public-access probe | ✅ Exit 0 | `POST /orders/checkout` returned 201, `GET /catalog` returned 200, auth guard verification calls remained 0 |
| `pnpm typecheck` | ✅ Exit 0 | Contracts, web, and API typechecks passed |
| `pnpm build` | ✅ Exit 0 | Contracts, Vite web, and API builds passed |
| `git diff --check` | ✅ Exit 0 | No whitespace errors; Git emitted LF→CRLF working-copy warnings |

The first auxiliary public-access probe attempt failed during verifier test-module construction with `UnknownDependenciesException` because its harness omitted `AuthService`; the corrected harness supplied that dependency and passed. No product request ran in the failed attempt.

`git diff --check` does not inspect untracked files. The current Unit 5 source/test files are untracked in this local-only worktree, so the successful command is exact but has that Git limitation.

### Coverage

Coverage analysis was skipped because `openspec/config.yaml:22` records no available coverage command or tool. There is no configured percentage threshold.

Behavioral coverage for the target is eight tests: three Nest/Supertest authentication and authorization tests plus five state-machine/transaction-orchestration tests.

### Spec Compliance Matrix

| Requirement | Scenario | Runtime evidence | Result |
|---|---|---|---|
| Order State Transitions | Valid dispatch progression | `apps/api/test/auth-transition.e2e-spec.ts:131-157`; focused and full suites passed | ✅ COMPLIANT |
| Order State Transitions | Invalid transition | `apps/api/test/auth-transition.e2e-spec.ts:159-172`; focused and full suites passed | ✅ COMPLIANT |
| Public and Operator Access | Authenticated operator access | `apps/api/test/auth-transition.e2e-spec.ts:80-95,117-125`; focused and full suites passed | ✅ COMPLIANT |
| Public and Operator Access | Unauthenticated or invalid access | `apps/api/test/auth-transition.e2e-spec.ts:97-115`; focused and full suites passed | ✅ COMPLIANT |

**Spec scenario summary**: 4/4 Unit 5 scenarios compliant.

### Granular Requirement Evidence

| Requirement | Runtime/source evidence | Status |
|---|---|---|
| Static bcrypt-compatible operator verification | `apps/api/src/auth/auth.service.ts:21-27`; successful and rejected bcrypt login at `apps/api/test/auth-transition.e2e-spec.ts:80-101` | ✅ Verified |
| HS256 JWT exactly 15 minutes | Signing and algorithm restriction at `apps/api/src/auth/auth.service.ts:24-37`; `exp - iat === 900` at `apps/api/test/auth-transition.e2e-spec.ts:91-95` | ✅ Verified |
| Cookie `HttpOnly; Secure; SameSite=Strict; Path=/` | `apps/api/src/auth/auth.controller.ts:17-23`; header assertions at `apps/api/test/auth-transition.e2e-spec.ts:82-90` | ✅ Verified |
| Absent, malformed/invalid, and expired cookie rejected before mutation/disclosure | Guard runs before handler at `apps/api/src/auth/operator.guard.ts:15-21` and `apps/api/src/orders/orders.controller.ts:22-29`; 401 responses and zero transition calls at `apps/api/test/auth-transition.e2e-spec.ts:103-125` | ✅ Verified |
| Public catalog and checkout remain public | No guards at `apps/api/src/catalog/catalog.controller.ts:5-12` or `apps/api/src/orders/orders.controller.ts:15-20`; corrected auxiliary HTTP probe passed with zero guard verification calls | ⚠️ Verified now, but no durable HTTP regression test |
| Forward chain and cancellation only from `PENDING`/`CONFIRMED` | State table at `apps/api/src/orders/transition.service.ts:8-20`; branch matrix and cancellation test at `apps/api/test/auth-transition.e2e-spec.ts:131-157` | ✅ Verified |
| Prior-state filter, history append, and exactly one pending status outbox in one native transaction | `apps/api/src/orders/transition.service.ts:29-72`; call-shape assertions at `apps/api/test/auth-transition.e2e-spec.ts:137-150` | ⚠️ Implemented and mock-verified; real replica-set atomicity unproven |
| Invalid/stale transition leaves data unchanged | Early invalid rejection and stale prior-state conflict at `apps/api/src/orders/transition.service.ts:34-47`; no-update/no-outbox assertions at `apps/api/test/auth-transition.e2e-spec.ts:159-172` | ⚠️ Mock-verified; real rollback/isolation unproven |
| No registration, refresh, or Unit 6+ scope | Auth controller exposes only login at `apps/api/src/auth/auth.controller.ts:6-25`; source route inventory contains catalog, checkout, transition, health, and login only; no projection/Cassandra source was found | ✅ Verified |
| Canonical UUID, Zod, Nest, and native Mongo patterns | Zod contracts at `packages/contracts/src/index.ts:41-48`; canonical UUIDv4 path check at `apps/api/src/orders/orders.controller.ts:25-29`; Nest modules/controllers/guard; native `Db`, `MongoClient`, session at `apps/api/src/orders/transition.service.ts:4-5,23-32` | ✅ Verified |

### Correctness (Static Evidence)

| Area | Status | Notes |
|---|---|---|
| Authentication | ✅ Implemented | Bcrypt compare, configured principal, HS256-only signing/verification, and 900-second lifetime |
| Authorization boundary | ✅ Implemented | Guard decorates only the transition route and rejects before controller/service execution |
| Public boundaries | ✅ Implemented | Catalog and checkout have no guard; auxiliary HTTP probe confirmed current routing behavior |
| Transition model | ✅ Implemented | Exact forward map plus cancellation from `PENDING` and `CONFIRMED` only |
| Mongo orchestration | ✅ Implemented | Read/update/outbox all receive the same native session inside one `withTransaction` with majority write concern |
| Stale-state protection | ✅ Implemented | Update filters both `_id` and observed prior status; unmatched update raises conflict before outbox insertion |
| Scope control | ✅ Implemented | No registration, refresh, projection worker/controller, Cassandra client, or web operator implementation in Unit 5 |

### Design Coherence

| Decision | Followed? | Evidence |
|---|---|---|
| Native Mongo rather than Mongoose | ✅ Yes | `apps/api/src/orders/transition.service.ts:4-5,24-32` |
| Canonical UUID strings | ✅ Yes | `packages/contracts/src/index.ts:47-48`, `apps/api/src/orders/orders.controller.ts:25-29`, native `randomUUID` at `apps/api/src/orders/transition.service.ts:3,40-51` |
| Static operator, bcrypt, 15-minute HS256 secure cookie, no registration/refresh | ✅ Yes | `apps/api/src/auth/auth.service.ts:6-37`, `apps/api/src/auth/auth.controller.ts:6-25` |
| Transition filters state and emits outbox atomically | ✅ Source coherent | `apps/api/src/orders/transition.service.ts:32-69`; infrastructure-level proof remains absent |
| Public catalog/checkout; protected mutation | ✅ Yes | `apps/api/src/catalog/catalog.controller.ts:5-12`, `apps/api/src/orders/orders.controller.ts:15-29` |

### TDD Compliance

The cumulative apply-progress artifact was read from Engram observation `#487`.

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | Unit 5 row includes safety net, RED, GREEN, triangulation, and refactor evidence |
| Target task has tests | ✅ | 1/1 target task; `apps/api/test/auth-transition.e2e-spec.ts` exists |
| RED confirmed | ✅ with provenance limitation | `#487` records initial focused collection failure because auth/transition modules and JWT dependency were absent; historical RED was not replayed against a reverted tree |
| GREEN confirmed | ✅ | Independent focused run passed 8/8 |
| Triangulation adequate | ✅ | Valid login, rejected login, absent/malformed/expired session, protected success, all forward branches, allowed cancellation, invalid transition, and stale transition |
| Safety net reported | ✅ with provenance limitation | `#487` records the pre-Unit-5 baseline as 4 suites/24 tests; the historical baseline was not replayed against a reverted tree |
| Refactor | ➖ | Subjective; current build, typecheck, focused tests, and full tests remain green |

**TDD compliance**: 6/6 objective checks satisfied. Historical RED and pre-change safety-net claims are traceable to `#487`, while current GREEN was independently executed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---:|---:|---|
| Unit/service orchestration | 5 | 1 mixed file | Jest with fake Mongo session/collections |
| Nest HTTP integration | 3 | 1 mixed file | Jest, Nest TestingModule, Supertest; transition dependency mocked |
| Real infrastructure E2E | 0 | 0 | Not executed for Unit 5 |
| **Total** | **8** | **1 unique file** | |

The capability cache labels Jest/Supertest as E2E (`openspec/config.yaml:17-21`), but the three HTTP tests are more accurately integration tests because the target transition service is replaced by a mock.

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected/configured (`openspec/config.yaml:22`).

### Assertion Quality

**Assertion quality**: ✅ All target assertions invoke production authentication, guard, state-machine, controller, or transition-orchestration code. No tautologies, ghost loops, assertion-free paths, or mock-to-assertion imbalance were found.

### Quality Metrics

**Linter**: ➖ Not available (`openspec/config.yaml:24`)

**Type checker**: ✅ No errors

**Build**: ✅ Passed

**Diff whitespace check**: ✅ Passed for tracked diffs, with LF→CRLF warnings and the untracked-file limitation noted above

### Issues Found

#### CRITICAL

None.

#### WARNING

1. **Real MongoDB replica-set atomicity is not proven.** `apps/api/test/auth-transition.e2e-spec.ts:29-41` implements `withTransaction`, `findOne`, `updateOne`, and `insertOne` as Jest fakes; `apps/api/test/auth-transition.e2e-spec.ts:137-150` proves call shape only. It cannot prove commit/abort behavior, write-conflict retries, isolation, or exactly one committed outbox record on a real replica set. The production transaction boundary is present at `apps/api/src/orders/transition.service.ts:29-72`.
2. **Public-access regression coverage is not durable.** Current public HTTP behavior passed the independent auxiliary probe, but the committed checkout test calls the controller directly (`apps/api/test/orders-checkout.e2e-spec.ts:151-164`) and cannot catch accidental guard metadata. There is no persisted Supertest test for public `GET /catalog` and `POST /orders/checkout` together.
3. **The task summary is stale.** `openspec/changes/restaurant-polyglot-platform/tasks.md:10,23-24` still says four slices complete/six remaining and groups slices 5–6 as pending, while task 3.1 is checked and described as verified at `openspec/changes/restaurant-polyglot-platform/tasks.md:46-47`. The authoritative checkbox count is five complete/five pending.

#### SUGGESTION

None beyond closing the two evidence gaps in a later verification slice. No code or task corrections were made during this verification.

### Remaining Change Work (Out of Scope)

- Task 3.2 / Unit 6 — Cassandra projection
- Task 4.1 / Unit 7 — catalog data and web test/style foundation
- Task 4.2 / Unit 8 — public web flows
- Task 5.1 / Unit 9 — operator web
- Task 5.2 / Unit 10 — UI/database evidence and load checks

These unchecked later tasks do not affect the Unit 5 partial verdict.

---

## Re-verification — Authentication Configuration Remediation

**Date**: 2026-07-18
**Trigger**: Re-verify Unit 5 after remediation of critical finding Engram `#563`
**Current verdict**: **PASS WITH WARNINGS**

The critical default-credential and hard-coded JWT-secret vulnerability is **CLOSED**. Unit 5 retains its original authentication, authorization, cookie, and transition behavior. The remaining warnings are evidence limitations, principally the absence of a real MongoDB replica-set transaction test.

### Remediation Closure Matrix

| Remediation obligation | Evidence | Result |
|---|---|---|
| Remove all operator/JWT defaults | `apps/api/src/auth/auth.service.ts:12-14`; repository search found no previous hash, default username expression, default password constant, or development JWT secret | ✅ CLOSED |
| Reject absent and whitespace-only auth values deterministically | `apps/api/src/auth/auth.service.ts:12-14`; parameterized tests at `apps/api/test/auth-transition.e2e-spec.ts:33-43` | ✅ CLOSED |
| Require all three values through Compose without storing them | `infra/compose.yaml:38-40`; mandatory `${VAR:?message}` interpolation only | ✅ CLOSED |
| Validate real Compose interpolation with temporary non-secret values | `docker compose -f infra/compose.yaml config --quiet` passed using process-local verification placeholders | ✅ CLOSED |
| Reject missing Compose values | Independent command rejected `OPERATOR_USERNAME`, `OPERATOR_PASSWORD_HASH`, and `JWT_SECRET` one at a time with exit 1 and each deterministic `NAME is required` message | ✅ CLOSED |
| Preserve configured injection and original auth behavior | Generated test-only bcrypt hash/JWT secret at `apps/api/test/auth-transition.e2e-spec.ts:21-27`; login/cookie/guard tests at `:66-135` passed | ✅ CLOSED |
| Preserve transition behavior | State and transaction-orchestration tests at `apps/api/test/auth-transition.e2e-spec.ts:137-180` passed | ✅ CLOSED |
| Correct cumulative task summary | `openspec/changes/restaurant-polyglot-platform/tasks.md:10,23-29,47-50` now records five complete/five pending and the remediation | ✅ CLOSED |

### Re-verification Command Evidence

| Command | Result | Evidence |
|---|---|---|
| Focused contracts build plus `auth-transition.e2e-spec.ts` | ✅ Exit 0 | 1 suite, 16/16 tests passed in 7.354 s |
| `pnpm test` | ✅ Exit 0 | 5 suites, 40/40 tests passed in 12.693 s |
| `pnpm typecheck` | ✅ Exit 0 | Contracts, web, and API passed |
| `pnpm build` | ✅ Exit 0 | Contracts, Vite web, and API passed |
| `git diff --check` | ✅ Exit 0 | No whitespace errors; LF→CRLF working-copy warnings only |
| `docker compose -f infra/compose.yaml config --quiet` with temporary placeholders | ✅ Exit 0 | Configuration validated; no services started and no values persisted |
| Same Compose command with all auth variables removed | ✅ Expected rejection | Docker Compose exited 1 with `OPERATOR_USERNAME is required` |
| Same Compose command omitting each auth variable separately | ✅ Expected rejection | Each of the three cases exited 1 with its matching deterministic message |

An additional diagnostic showed that Docker Compose treats a whitespace-only string as present. This is not a bypass: `requiredAuthEnv()` trims values and rejects whitespace before authentication configuration can load (`apps/api/src/auth/auth.service.ts:12-14`). No `up`, `run`, `start`, volume, or container command was executed.

`git diff --check` retains its standard limitation: it does not inspect untracked files. Unit 5 source/test files remain untracked in this local-only worktree.

### Current Scenario Matrix

| Requirement | Scenario | Runtime evidence | Result |
|---|---|---|---|
| Authentication configuration safety | Missing/blank/configured values and Compose requirements | `apps/api/test/auth-transition.e2e-spec.ts:33-48`; 8 remediation tests passed; independent Compose config checks passed | ✅ COMPLIANT |
| Order State Transitions | Valid dispatch progression | `apps/api/test/auth-transition.e2e-spec.ts:140-165`; focused and full suites passed | ✅ COMPLIANT |
| Order State Transitions | Invalid/stale transition | `apps/api/test/auth-transition.e2e-spec.ts:167-180`; focused and full suites passed | ✅ COMPLIANT at mock level |
| Public and Operator Access | Authenticated operator access | `apps/api/test/auth-transition.e2e-spec.ts:94-104,126-134`; focused and full suites passed | ✅ COMPLIANT |
| Public and Operator Access | Unauthenticated or invalid access | `apps/api/test/auth-transition.e2e-spec.ts:106-124`; focused and full suites passed | ✅ COMPLIANT |

**Unit 5 scenario summary**: 5/5 current target scenarios compliant. Original four specification scenarios remain regression-green.

### Strict TDD Remediation Audit

The cumulative apply-progress artifact remains Engram `#487` and now includes a dedicated `3.1 security remediation` row.

| Check | Result | Details |
|---|---|---|
| Safety net | ✅ | `#487` records 32/32 tests before remediation |
| RED | ✅ with historical provenance | `#487` records four initial failures: three missing-variable fallback cases and absent Compose requirements |
| GREEN | ✅ Independently confirmed | Focused suite passed 16/16 |
| Triangulation | ✅ | Missing and blank cases for all three variables, configured pass-through, Compose source, actual Compose interpolation, and retained auth/transition behavior |
| Full regression | ✅ Independently confirmed | 40/40 tests passed |
| Assertion quality | ✅ | New tests call `loadAuthConfig`, inspect exact Compose requirements, and use non-empty fixed parameter sets; no tautology or ghost loop |

Historical RED was not replayed against reverted vulnerable source. Its provenance is the cumulative apply record `#487`; current GREEN and Compose behavior were executed independently.

### Current Test Layer Distribution

| Layer | Tests | Notes |
|---|---:|---|
| Configuration unit/static validation | 8 | Six missing/blank cases, configured pass-through, Compose requirements |
| Nest HTTP integration | 3 | Real login/controller/guard with transition service mocked |
| Transition unit/orchestration | 5 | Fake Mongo session and collections |
| Real Mongo infrastructure | 0 | Not executed |
| **Total** | **16** | One mixed focused test file |

Coverage percentages remain unavailable because `openspec/config.yaml:22` defines no coverage tool or command. Typecheck and build passed; no linter is configured.

### Current Findings

#### CRITICAL

None. The critical finding recorded in Engram `#563` is closed by source, test, and Compose runtime evidence.

#### WARNING

1. **Real MongoDB replica-set atomicity remains unproven.** `apps/api/test/auth-transition.e2e-spec.ts:51-63` uses fake sessions and collections, while `:145-157` validates orchestration call shape. This does not prove real commit/abort behavior, isolation, write-conflict retry behavior, or exactly one committed outbox record. Production code still uses one native majority transaction at `apps/api/src/orders/transition.service.ts:29-72`.
2. **Public-access regression coverage remains non-durable at HTTP level.** The historical independent HTTP probe passed, and source still leaves catalog/checkout unguarded, but the persisted checkout test invokes the controller directly at `apps/api/test/orders-checkout.e2e-spec.ts:151-164`.

#### CLOSED SINCE PRIOR VERIFICATION

1. Default operator credentials and JWT secret — closed by `apps/api/src/auth/auth.service.ts:12-14`, `infra/compose.yaml:38-40`, focused tests, repository search, and independent Compose validation.
2. Stale task summary — closed at `openspec/changes/restaurant-polyglot-platform/tasks.md:10,23-29,47-50`.

### Remaining Change Work (Still Out of Scope)

- Task 3.2 / Unit 6 — Cassandra projection
- Task 4.1 / Unit 7 — catalog data and web test/style foundation
- Task 4.2 / Unit 8 — public web flows
- Task 5.1 / Unit 9 — operator web
- Task 5.2 / Unit 10 — UI/database evidence and load checks

These later tasks remain change work, not Unit 5 defects.
