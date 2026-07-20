import { BadRequestException, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  projectionActivityRequestSchema,
  projectionOrderTimelineRequestSchema,
} from '@app/contracts';
import { OperatorGuard } from '../auth/operator.guard';
import { ProjectionWorker } from './projection.worker';

@Controller('projections')
@UseGuards(OperatorGuard)
export class ProjectionController {
  constructor(private readonly projections: ProjectionWorker) {}

  @Get('status')
  status() {
    return this.projections.getStatus();
  }

  @Post('replay')
  replay() {
    return this.projections.replay();
  }

  @Get('orders/:orderId/timeline')
  timeline(@Param('orderId') orderId: string) {
    const parsed = projectionOrderTimelineRequestSchema.safeParse({ orderId });
    if (!parsed.success) throw new BadRequestException('Invalid projection order id');
    return this.projections.getOrderTimeline(parsed.data.orderId);
  }

  @Get('restaurants/:restaurantId/activity')
  activity(@Param('restaurantId') restaurantId: string, @Query('day') day: string) {
    const parsed = projectionActivityRequestSchema.safeParse({ restaurantId, day });
    if (!parsed.success) throw new BadRequestException('Invalid projection activity request');
    return this.projections.getRestaurantActivity(parsed.data.restaurantId, parsed.data.day);
  }
}
