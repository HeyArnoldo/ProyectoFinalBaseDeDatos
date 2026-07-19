import { Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';
import { MongoBootstrapService } from './bootstrap.service';
import { MONGO_CLIENT, MONGO_DATABASE } from './mongo.tokens';

export { MONGO_CLIENT, MONGO_DATABASE } from './mongo.tokens';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to connect to MongoDB`);
  }
  return value;
}

@Injectable()
export class MongoLifecycle implements OnApplicationShutdown {
  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}

@Module({
  providers: [
    {
      provide: MONGO_CLIENT,
      useFactory: async (): Promise<MongoClient> => {
        const uri = requiredEnv('MONGODB_URI');
        requiredEnv('MONGODB_DATABASE');
        const client = new MongoClient(uri, {
          serverSelectionTimeoutMS: 5_000,
        });
        await client.connect();
        return client;
      },
    },
    {
      provide: MONGO_DATABASE,
      inject: [MONGO_CLIENT],
      useFactory: (client: MongoClient): Db =>
        client.db(requiredEnv('MONGODB_DATABASE')),
    },
    MongoLifecycle,
    MongoBootstrapService,
  ],
  exports: [MONGO_CLIENT, MONGO_DATABASE],
})
export class MongoModule {}
