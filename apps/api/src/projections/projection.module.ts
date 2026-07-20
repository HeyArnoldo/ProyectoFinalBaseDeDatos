import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MongoModule } from '../database/mongo.provider';
import { CassandraProviderModule } from './cassandra.provider';
import { CassandraBootstrapService } from './cql.bootstrap';
import { ProjectionController } from './projection.controller';
import { ProjectionWorker } from './projection.worker';

@Module({
  imports: [AuthModule, MongoModule, CassandraProviderModule],
  controllers: [ProjectionController],
  providers: [CassandraBootstrapService, ProjectionWorker],
  exports: [ProjectionWorker],
})
export class ProjectionModule {}
