# Cassandra Activity Projections Specification

## Purpose

Define minimal query-first operational projections from the MongoDB outbox.

## Requirements

### Requirement: Two Query-First Views

Cassandra SHALL expose only `order_timeline_by_order` (partition `orderId`) and `restaurant_activity_by_day` (partition `(restaurantId, day)`). Event identity MUST key each row; reads MUST NOT require `ALLOW FILTERING`.

#### Scenario: Supported timeline reads

- GIVEN projected events
- WHEN reads use partition keys
- THEN ordered matching events return

#### Scenario: Unsupported filtered read

- GIVEN no supported partition key
- WHEN the API is called
- THEN it rejects without `ALLOW FILTERING`

### Requirement: Idempotent, Observable Projection

Each outbox event MUST be applied at least once and idempotently to both views. Projection status MUST expose lag and processing state; after an outage, replay MUST converge both views.

#### Scenario: Normal projection

- GIVEN an unpublished outbox event
- WHEN the worker processes it
- THEN both views contain it and status is processed

#### Scenario: Duplicate delivery

- GIVEN a projected event
- WHEN it is redelivered
- THEN each view retains one logical event

#### Scenario: Outage recovery

- GIVEN Cassandra fails while events accumulate
- WHEN replay completes
- THEN both views converge and lag clears
