# Design: Restaurant Polyglot Platform

## Technical Approach

The current pnpm workspace has a minimal React/Vite shell, nginx API proxy, shared catalog Zod schema, native Mongo bootstrap, three-item seed, and active-only catalog query. Extend these actual patterns. React 19.2.7 supplies lazy/Suspense and transitions; Tailwind v4 uses `@tailwindcss/vite` plus CSS-first `@theme`; Vite 7.3.1 emits static hashed assets and lazy chunks. Only explicit `VITE_API_BASE_URL` is client-visible; never secrets.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Native `mongodb` / Mongoose | Less Nest sugar / direct controls | Keep native transactions, validators, indexes, and explain. |
| `cassandra-driver` / ORM | Manual CQL / exact access | Keep the officially verified npm driver with `{prepare:true,isIdempotent:true}`. |
| UUID / `ObjectId` | Larger keys / cross-store identity | Keep canonical UUIDv4 strings and `types.Uuid.fromString`. |
| Embedded poller / broker | Single instance / bounded topology | Keep the leased API poller; no Kafka or worker service. |
| Static operator / users | One operator / minimal surface | Keep bcrypt credentials and 15-minute HS256 cookie (`HttpOnly; Secure; SameSite=Strict; Path=/`), without registration/refresh. |

## Data Flow

```text
Browser -> nginx/static web -> Nest API -> MongoDB order + outbox
                                      `-> embedded poller -> Cassandra views
```

## Operational Persistence

Strict Mongo `$jsonSchema` still enforces UUID strings, BSON integer money/quantities, dates, booleans, and exact required shapes. Extend `catalog_items` with required `category`/`description` and optional nullable `imageUrl`; retain unique `uq_catalog_restaurant_sku`. `orders` keeps guest/snapshots/total/status/history/idempotency with `uq_orders_idempotency` and `ix_orders_restaurant_createdAt`. `outbox` keeps event/payload/lease/retry/result with `uq_outbox_eventId` and `ix_outbox_claim`.

Checkout precomputes IDs/time/hash and transactionally inserts order/outbox with majority writes. Retries reuse values; matching duplicates return the original, hash mismatch returns 409. Transitions atomically filter state, append history, and emit outbox.

```cql
CREATE KEYSPACE IF NOT EXISTS restaurant_projection
 WITH replication={'class':'NetworkTopologyStrategy','datacenter1':1};
CREATE TABLE IF NOT EXISTS restaurant_projection.order_timeline_by_order (
 order_id uuid, occurred_at timestamp, event_id uuid, restaurant_id uuid,
 event_type text, order_status text, total_cents int,
 PRIMARY KEY ((order_id),occurred_at,event_id)
) WITH CLUSTERING ORDER BY (occurred_at ASC,event_id ASC);
CREATE TABLE IF NOT EXISTS restaurant_projection.restaurant_activity_by_day (
 restaurant_id uuid, day date, occurred_at timestamp, event_id uuid, order_id uuid,
 event_type text, order_status text, total_cents int,
 PRIMARY KEY ((restaurant_id,day),occurred_at,event_id)
) WITH CLUSTERING ORDER BY (occurred_at DESC,event_id ASC);
```

Keep the 2-second poll, 30-second lease, capped retry, replay, lag/state reporting, and idempotent upserts. Public API remains active catalog plus checkout. Operator session protects mutations, transitions, status/replay, and both exact-partition reads; never `ALLOW FILTERING`.

## Frontend Experience

**Visual direction:** contemporary Peruvian brasa editorial, not generic SaaS cards. Warm cream, charcoal, ember, saffron, and herb `@theme` tokens; strong locally served display/body variable fonts; food-led asymmetry, generous type, dividers, and semantic state color. All UI copy is neutral Spanish.

| Route | Composition |
|---|---|
| `/` | `CatalogPage`: hero, `CategoryFilter`, `ProductGrid/ProductTile`, `CartDrawer`. |
| `/checkout` | Labeled guest form, summary, loading/error submission. |
| `/confirmacion/:orderId` | UUID, authoritative total, pending projection state from checkout response; no public projection read. |
| `/operador/login` | Credential form and unauthorized/expired state. |
| `/operador/*` | Lazy `OperatorLayout`; `OrdersBoard` transitions and `ProjectionBoard` lag/replay/two reads. |

TanStack Query owns server state; `CartProvider` is a small reducer/context. React Hook Form resolves shared Zod checkout/login schemas. `startTransition` wraps category and non-urgent board filters; avoid manual memoization without measurement. Suspense wraps only the lazy operator subtree. Tailwind responsive, `focus-visible`, and `motion-reduce` variants cover keyboard navigation, WCAG-AA contrast, landmarks, and loading/empty/offline/error/success/unauthorized states. A small `components/ui` layer provides buttons, fields, notices, and badges.

Seed about 12 neutral-Spanish products across brasa, combos, guarniciones, and bebidas, including inactive rows; API remains active-only. Optional local `/images/*.webp` URLs use dimensions, `loading="lazy"`, async decoding, and deterministic fallback artwork on null/error.

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/web/package.json`, `vite.config.ts`, `src/main.tsx` | Modify/Create | Pin React 19.2.7/Vite 7.3.1; add Query, RHF, Tailwind v4, Vitest, providers. |
| `apps/web/src/app/{router,providers}.tsx`, `layouts/**` | Create | Public/lazy operator routes. |
| `apps/web/src/features/{catalog,cart,checkout,auth,operator}/**` | Create | Pages, queries, reducer, forms, boards. |
| `apps/web/src/{styles.css,components/ui/**}`, `public/images/**` | Create | Tokens, primitives, optimized assets/fallback. |
| `packages/contracts/src/{catalog,checkout,auth,operator}.ts`, `index.ts` | Create/Modify | Shared Zod contracts. |
| `apps/api/src/database/{bootstrap,seed}.service.ts`, `catalog/catalog.service.ts` | Modify | Fields, ~12-item seed, categorized active sorting. |
| `apps/web/{Dockerfile,nginx.conf}` | Modify | Build contracts; cache hashes; retain SPA/proxy. |
| `apps/web/{vitest.config.ts,playwright.config.ts,src/test/**}`, `evidence/ui/**` | Create | UI tests/evidence. |

## Testing Strategy

| Layer | Approach |
|---|---|
| UI TDD | Vitest + Testing Library/user-event: cart, filters, forms, states, routing, fallback. |
| API | Existing Jest/Supertest: validator, active-only, checkout, auth/projection boundaries. |
| Final flow | Playwright only for responsive checkout and keyboard/reduced-motion/unauthorized evidence; no service/container. |

## Migration / Rollout

Bootstrap applies `collMod`, then replaces fixed seed IDs with complete documents (not current `$setOnInsert`), upgrading the existing three rows before readiness. Static/lazy Vite output and optimized assets keep nginx within 96 MiB. The four services, limits, private databases, volumes, health gates, logging, and `docker compose exec` shells remain unchanged; no persistent service is added.

## Open Questions

None.
