import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, OPERATOR_SESSION_COOKIE, type OperatorPrincipal } from './auth.service';

export type OperatorRequest = Request & { operator?: OperatorPrincipal };

function cookieFromHeader(header: string | undefined, name: string): string | undefined {
  return header?.split(';').map((part) => part.trim().split('=')).find(([key]) => key === name)?.[1];
}

@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<OperatorRequest>();
    const token = cookieFromHeader(request.headers.cookie, OPERATOR_SESSION_COOKIE);
    const operator = token ? this.auth.verify(token) : null;
    if (!operator) throw new UnauthorizedException();
    request.operator = operator;
    return true;
  }
}
