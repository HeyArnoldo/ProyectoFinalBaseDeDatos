import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AUTH_CONFIG, AuthService, loadAuthConfig } from './auth.service';
import { OperatorGuard } from './operator.guard';

@Module({
  controllers: [AuthController],
  providers: [{ provide: AUTH_CONFIG, useFactory: loadAuthConfig }, AuthService, OperatorGuard],
  exports: [AuthService, OperatorGuard],
})
export class AuthModule {}
