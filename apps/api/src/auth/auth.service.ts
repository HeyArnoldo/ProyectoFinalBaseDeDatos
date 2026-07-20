import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { OperatorLoginRequest } from '@app/contracts';

export const OPERATOR_SESSION_COOKIE = 'operator_session';
export const OPERATOR_SESSION_TTL_SECONDS = 15 * 60;
export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export type AuthConfig = { username: string; passwordHash: string; jwtSecret: string };
export type OperatorPrincipal = { sub: string; role: 'operator' };

function requiredAuthEnv(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value; }

function requiredPasswordHash(): string {
  const encoded = requiredAuthEnv('OPERATOR_PASSWORD_HASH_B64');
  const passwordHash = Buffer.from(encoded, 'base64').toString('utf8');
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash)) {
    throw new Error('OPERATOR_PASSWORD_HASH_B64 must contain a base64-encoded bcrypt hash');
  }
  return passwordHash;
}

export function loadAuthConfig(): AuthConfig { return { username: requiredAuthEnv('OPERATOR_USERNAME'), passwordHash: requiredPasswordHash(), jwtSecret: requiredAuthEnv('JWT_SECRET') }; }

@Injectable()
export class AuthService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  async authenticate(request: OperatorLoginRequest): Promise<string | null> {
    if (request.username !== this.config.username || !(await bcrypt.compare(request.password, this.config.passwordHash))) return null;

    return jwt.sign({ sub: this.config.username, role: 'operator' }, this.config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: OPERATOR_SESSION_TTL_SECONDS,
    });
  }

  verify(token: string): OperatorPrincipal | null {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || payload.sub !== this.config.username || payload.role !== 'operator') return null;
      return { sub: payload.sub, role: 'operator' };
    } catch {
      return null;
    }
  }
}
