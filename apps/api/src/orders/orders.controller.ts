import { BadRequestException, Body, Controller, Optional, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { checkoutRequestSchema, orderTransitionRequestSchema } from '@app/contracts';
import { DEFAULT_RESTAURANT_ID } from '../database/seed.service';
import { OperatorGuard } from '../auth/operator.guard';
import { CheckoutService } from './checkout.service';
import { TransitionService } from './transition.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly checkoutService: CheckoutService,
    @Optional() private readonly transitionService?: TransitionService,
  ) {}

  @Post('checkout')
  async checkout(@Body() body: unknown, @Query('restaurantId') restaurantId?: string) {
    const parsed = checkoutRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid checkout request');
    return this.checkoutService.checkout(parsed.data, restaurantId ?? DEFAULT_RESTAURANT_ID);
  }

  @Patch(':orderId/status')
  @UseGuards(OperatorGuard)
  async transition(@Param('orderId') orderId: string, @Body() body: unknown) {
    const parsedId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(orderId);
    const parsed = orderTransitionRequestSchema.safeParse(body);
    if (!parsedId || !parsed.success) throw new BadRequestException('Invalid order transition request');
    if (!this.transitionService) throw new Error('Transition service is not configured');
    return this.transitionService.transition(orderId, parsed.data.status);
  }
}
