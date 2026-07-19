import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OperatorGuard } from './operator.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, OperatorGuard],
  exports: [AuthService, OperatorGuard],
})
export class AuthModule {}
