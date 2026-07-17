# MongoDB Operational Store Specification

## Purpose

Define MongoDB as the validated operational source of truth.

## Requirements

### Requirement: Validated and Indexed Operational Records

MongoDB MUST validate required typed fields for `catalog_items`, `orders`, and `outbox`. It MUST enforce unique `(restaurantId, sku)`, `idempotencyKey`, and `eventId` indexes plus compound `(restaurantId, createdAt)` indexing.

#### Scenario: Valid schema bootstrap

- GIVEN valid documents
- WHEN bootstrap runs
- THEN validators and required indexes exist

#### Scenario: Invalid or duplicate write

- GIVEN an invalid or duplicate direct write
- WHEN it is submitted
- THEN enforcement rejects it without a record

### Requirement: Atomic Checkout and Reproducible Evidence

Checkout MUST commit one order and its outbox event in one transaction. Repeated idempotency keys MUST return the original result. Deterministic seed data MUST reproduce aggregation and `explain("executionStats")` evidence identifying the selected index.

#### Scenario: Atomic idempotent checkout

- GIVEN a valid checkout key
- WHEN checkout is retried
- THEN one order/event and the same response exist

#### Scenario: Aborted transaction

- GIVEN a forced transaction failure
- WHEN it aborts
- THEN neither order nor outbox exists

#### Scenario: Repeatable query evidence

- GIVEN the deterministic seed
- WHEN evidence runs twice
- THEN matching artifacts name a required index
