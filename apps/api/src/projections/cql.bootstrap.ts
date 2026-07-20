import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Client } from 'cassandra-driver';
import { CASSANDRA_CLIENT, CASSANDRA_KEYSPACE } from './cassandra.provider';

export const CASSANDRA_BOOTSTRAP_STATEMENTS = [
  `CREATE KEYSPACE IF NOT EXISTS ${CASSANDRA_KEYSPACE} WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': 1}`,
  `ALTER KEYSPACE ${CASSANDRA_KEYSPACE} WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': 1}`,
  `CREATE TABLE IF NOT EXISTS ${CASSANDRA_KEYSPACE}.order_timeline_by_order (
    order_id uuid,
    occurred_at timestamp,
    event_id uuid,
    restaurant_id uuid,
    event_type text,
    status text,
    total_cents int,
    PRIMARY KEY ((order_id), occurred_at, event_id)
  ) WITH CLUSTERING ORDER BY (occurred_at ASC, event_id ASC)`,
  `CREATE TABLE IF NOT EXISTS ${CASSANDRA_KEYSPACE}.restaurant_activity_by_day (
    restaurant_id uuid,
    day date,
    occurred_at timestamp,
    event_id uuid,
    order_id uuid,
    event_type text,
    status text,
    total_cents int,
    PRIMARY KEY ((restaurant_id, day), occurred_at, event_id)
  ) WITH CLUSTERING ORDER BY (occurred_at DESC, event_id ASC)`,
] as const;

export async function bootstrapCassandra(client: Client): Promise<void> {
  for (const statement of CASSANDRA_BOOTSTRAP_STATEMENTS) {
    await client.execute(statement, [], { isIdempotent: true });
  }
}

@Injectable()
export class CassandraBootstrapService implements OnModuleInit {
  private ready?: Promise<void>;

  constructor(@Inject(CASSANDRA_CLIENT) private readonly client: Client) {}

  ensureReady(): Promise<void> {
    this.ready ??= bootstrapCassandra(this.client);
    return this.ready;
  }

  async onModuleInit(): Promise<void> {
    await this.ensureReady();
  }
}
