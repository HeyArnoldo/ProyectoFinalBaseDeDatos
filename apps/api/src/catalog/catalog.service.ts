import { Inject, Injectable } from '@nestjs/common';
import { catalogItemSchema } from '@app/contracts';
import { Db } from 'mongodb';
import { MONGO_DATABASE } from '../database/mongo.provider';

@Injectable()
export class CatalogService {
  constructor(@Inject(MONGO_DATABASE) private readonly db: Db) {}

  async findActive(restaurantId: string) {
    const items = await this.db
      .collection('catalog_items')
      .find({ restaurantId, active: true })
      .sort({ category: 1, name: 1, sku: 1 })
      .toArray();

    return catalogItemSchema.array().parse(items);
  }
}
