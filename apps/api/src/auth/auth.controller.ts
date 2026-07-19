import { Body, Controller, Post, Res, UnauthorizedException } from '@nestjs/common';
import { operatorLoginRequestSchema } from '@app/contracts';
import type { Response } from 'express';
import { AuthService, OPERATOR_SESSION_COOKIE, OPERATOR_SESSION_TTL_SECONDS } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const parsed = operatorLoginRequestSchema.safeParse(body);
    if (!parsed.success) throw new UnauthorizedException('Invalid credentials');
    const token = await this.auth.authenticate(parsed.data);
    if (!token) throw new UnauthorizedException('Invalid credentials');

    response.cookie(OPERATOR_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: OPERATOR_SESSION_TTL_SECONDS * 1000,
    });
    return { authenticated: true, username: parsed.data.username };
  }
}
