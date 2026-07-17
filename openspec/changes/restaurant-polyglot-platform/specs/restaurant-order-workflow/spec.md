# Restaurant Order Workflow Specification

## Purpose

Define guest ordering against the active restaurant catalog.

## Requirements

### Requirement: Guest Checkout Uses Catalog Snapshots

Guest checkout MUST calculate totals server-side from active catalog prices, persist item snapshots, and ignore client totals.

#### Scenario: Server-calculated checkout

- GIVEN an active priced catalog
- WHEN a guest submits quantities and a forged total
- THEN the order stores server snapshots and total

#### Scenario: Inactive or invalid item

- GIVEN an invalid catalog item or quantity
- WHEN checkout is submitted
- THEN the system rejects it without an order

### Requirement: Order State Transitions

Only `PENDING → CONFIRMED → PREPARING → READY → DISPATCHED → DELIVERED` and `PENDING|CONFIRMED → CANCELLED` transitions MUST be permitted.

#### Scenario: Valid dispatch progression

- GIVEN an order in a valid preceding state
- WHEN an operator advances it
- THEN it reaches the next state

#### Scenario: Invalid transition

- GIVEN an order state
- WHEN an invalid transition is requested
- THEN the system rejects it without state change

### Requirement: Public and Operator Access

Only catalog reads and guest checkout MUST be public. Configured-credential login MUST issue a short-lived, secure, HTTP-only cookie. Catalog mutations, order transitions, projection status/replay, and Cassandra reads MUST require an authenticated operator. Invalid credentials or unauthenticated requests MUST be rejected without mutation or operational-data disclosure. Local `mongosh`/`cqlsh` is classroom infrastructure, never public API behavior.

#### Scenario: Authenticated operator access

- GIVEN valid configured credentials
- WHEN the operator logs in and invokes a protected operation
- THEN it receives the cookie and succeeds

#### Scenario: Unauthenticated or invalid access

- GIVEN invalid credentials or no session
- WHEN a protected or Cassandra read request arrives
- THEN it rejects without mutation or operational-data disclosure
