# Polyglot Local Runtime Specification

## Purpose

Define reproducible local runtime.

## Requirements

### Requirement: Four-Container Experimental Runtime

Compose MUST run exactly four persistent `web`, `api`, `mongodb`, and `cassandra` containers at 96, 384, 1536, and 3072 MiB (5088 total). Databases MUST use named volumes without host ports. PostgreSQL, Redis, Kafka, database GUIs, permanent metrics, payments, and WhatsApp MUST NOT run.

#### Scenario: Healthy deterministic startup

- GIVEN an empty environment
- WHEN Compose starts
- THEN health-gated seed data is queryable

#### Scenario: Database delay and restart

- GIVEN database delay or restart
- WHEN health is evaluated
- THEN dependents wait and data survives
