# Polyglot Local Runtime Specification

## Purpose

Define the bounded, reproducible local database runtime.

## Requirements

### Requirement: Four-Container Experimental Runtime

Compose MUST run exactly four persistent `web`, `api`, `mongodb`, and `cassandra` containers at 96, 384, 1536, and 3072 MiB (5088 total). Databases MUST use named volumes and publish no host ports; PostgreSQL, Redis, Kafka, database GUIs, permanent metrics, payments, and WhatsApp MUST NOT run.

#### Scenario: Healthy deterministic startup

- GIVEN an empty environment
- WHEN Compose starts
- THEN ordered health gates make deterministic seed data queryable

#### Scenario: Database delay and restart

- GIVEN a database delays or restarts
- WHEN Compose evaluates health and volumes
- THEN dependents wait and volume data survives recovery
