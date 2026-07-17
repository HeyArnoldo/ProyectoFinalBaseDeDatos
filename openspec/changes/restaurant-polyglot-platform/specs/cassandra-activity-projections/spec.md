# Cassandra Activity Projections Specification

## Purpose

Define query-first outbox projections.

## Requirements

### Requirement: Two Query-First Views

Cassandra SHALL expose only `order_timeline_by_order` by `orderId` and `restaurant_activity_by_day` by `(restaurantId,day)`. Event identity MUST key rows; reads MUST NOT use `ALLOW FILTERING`.

#### Scenario: Supported timeline reads

- GIVEN projected events
- WHEN reads use partition keys
- THEN ordered matches return

#### Scenario: Unsupported filtered read

- GIVEN no partition key
- WHEN the API is called
- THEN it rejects without `ALLOW FILTERING`

### Requirement: Idempotent, Observable Projection

Outbox events MUST project at least once and idempotently to both views. Status MUST expose lag/state; outage replay MUST converge both.

#### Scenario: Normal projection

- GIVEN an unpublished event
- WHEN the worker processes it
- THEN both views contain it and status is processed

#### Scenario: Duplicate delivery

- GIVEN a projected event
- WHEN redelivered
- THEN each view retains one logical event

#### Scenario: Outage recovery

- GIVEN Cassandra outage backlog
- WHEN replay completes
- THEN both views converge and lag clears
