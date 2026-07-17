# Restaurant Order Workflow Specification

## Purpose

Define guest ordering from the active catalog.

## Requirements

### Requirement: Guest Checkout Uses Catalog Snapshots

Guest checkout MUST price active items server-side, persist snapshots, and ignore client totals.

#### Scenario: Server-calculated checkout

- GIVEN active catalog items
- WHEN a guest submits a forged total
- THEN server-priced snapshots and total persist

#### Scenario: Inactive or invalid item

- GIVEN invalid items or quantity
- WHEN checkout submits
- THEN it rejects without an order

### Requirement: Order State Transitions

Only `PENDING → CONFIRMED → PREPARING → READY → DISPATCHED → DELIVERED` and `PENDING|CONFIRMED → CANCELLED` transitions MUST be permitted.

#### Scenario: Valid dispatch progression

- GIVEN a permitted prior state
- WHEN an operator advances it
- THEN the next state persists

#### Scenario: Invalid transition

- GIVEN any order state
- WHEN an invalid transition submits
- THEN it rejects without state change

### Requirement: Public and Operator Access

Only catalog reads and checkout MUST be public. Configured login MUST issue a short-lived, secure, HTTP-only cookie. Mutations, transitions, status/replay, and Cassandra reads MUST require an authenticated operator. Invalid or absent sessions MUST mutate or disclose nothing. `mongosh`/`cqlsh` are classroom infrastructure, never public API.

#### Scenario: Authenticated operator access

- GIVEN configured credentials
- WHEN an operator logs in
- THEN its cookie permits protected work

#### Scenario: Unauthenticated or invalid access

- GIVEN invalid credentials or no session
- WHEN protected work is requested
- THEN it rejects without mutation or data
