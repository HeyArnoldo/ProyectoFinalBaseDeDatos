import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MongoModule } from '../database/mongo.provider';
import { CheckoutService } from './checkout.service';
import { OrdersController } from './orders.controller';
import { TransitionService } from './transition.service';
import { OperatorOrdersService } from './operator-orders.service';

@Module({
  imports: [MongoModule, AuthModule],
  controllers: [OrdersController],
  providers: [CheckoutService, TransitionService, OperatorOrdersService],
})
export class OrdersModule {}
