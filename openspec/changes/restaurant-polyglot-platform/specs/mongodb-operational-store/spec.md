# MongoDB Operational Store Specification

## Purpose

Define MongoDB operational truth.

## Requirements

### Requirement: Validated and Indexed Operational Records

MongoDB MUST validate typed required fields in `catalog_items`, `orders`, and `outbox`; enforce unique `(restaurantId,sku)`, `idempotencyKey`, `eventId`, and compound `(restaurantId,createdAt)` indexes.

#### Scenario: Valid schema bootstrap

- GIVEN valid documents
- WHEN bootstrap runs
- THEN validators and indexes exist

#### Scenario: Invalid or duplicate write

- GIVEN invalid or duplicate writes
- WHEN submitted directly
- THEN enforcement rejects them without records

### Requirement: Atomic Checkout and Reproducible Evidence

Checkout MUST transactionally write one order/outbox event; repeated keys MUST return the original. Deterministic seed MUST reproduce aggregation and `explain("executionStats")` evidence naming its index.

#### Scenario: Atomic idempotent checkout

- GIVEN a checkout key
- WHEN checkout retries
- THEN one order/outbox and response exist

#### Scenario: Aborted transaction

- GIVEN transaction failure
- WHEN it aborts
- THEN no order/outbox exists

#### Scenario: Repeatable query evidence

- GIVEN deterministic seed
- WHEN evidence runs twice
- THEN matching artifacts name its index
