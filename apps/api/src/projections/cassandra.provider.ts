import { Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { Client } from 'cassandra-driver';

export const CASSANDRA_CLIENT = Symbol('CASSANDRA_CLIENT');
export const CASSANDRA_CONFIG = Symbol('CASSANDRA_CONFIG');
export const CASSANDRA_KEYSPACE = 'restaurant_projection';

export type CassandraConfig = {
  contactPoints: string[];
  localDataCenter: string;
  port: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to connect to Cassandra`);
  return value;
}

export function loadCassandraConfig(): CassandraConfig {
  const portValue = requiredEnv('CASSANDRA_PORT');
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('CASSANDRA_PORT must be a valid TCP port');
  }

  const contactPoints = requiredEnv('CASSANDRA_CONTACT_POINTS')
    .split(',')
    .map((contactPoint) => contactPoint.trim())
    .filter(Boolean);
  if (contactPoints.length === 0) throw new Error('CASSANDRA_CONTACT_POINTS is required to connect to Cassandra');

  return {
    contactPoints,
    localDataCenter: requiredEnv('CASSANDRA_LOCAL_DATACENTER'),
    port,
  };
}

export async function createCassandraClient(config: CassandraConfig): Promise<Client> {
  const client = new Client({
    contactPoints: config.contactPoints,
    localDataCenter: config.localDataCenter,
    protocolOptions: { port: config.port },
    queryOptions: { isIdempotent: true },
  });
  await client.connect();
  return client;
}

@Injectable()
export class CassandraLifecycle implements OnApplicationShutdown {
  constructor(@Inject(CASSANDRA_CLIENT) private readonly client: Client) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.shutdown();
  }
}

@Module({
  providers: [
    { provide: CASSANDRA_CONFIG, useFactory: loadCassandraConfig },
    {
      provide: CASSANDRA_CLIENT,
      inject: [CASSANDRA_CONFIG],
      useFactory: createCassandraClient,
    },
    CassandraLifecycle,
  ],
  exports: [CASSANDRA_CLIENT],
})
export class CassandraProviderModule {}
