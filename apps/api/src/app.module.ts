import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { OrdersModule } from './orders/orders.module';
import { ProjectionModule } from './projections/projection.module';

@Module({
  imports: [AuthModule, CatalogModule, OrdersModule, ProjectionModule],
  controllers: [HealthController],
})
export class AppModule {}
