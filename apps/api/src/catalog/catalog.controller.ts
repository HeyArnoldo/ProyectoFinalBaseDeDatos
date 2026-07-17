import { Controller, Get, Query } from '@nestjs/common';
import { DEFAULT_RESTAURANT_ID } from '../database/seed.service';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  findActive(@Query('restaurantId') restaurantId?: string) {
    return this.catalog.findActive(restaurantId ?? DEFAULT_RESTAURANT_ID);
  }
}
