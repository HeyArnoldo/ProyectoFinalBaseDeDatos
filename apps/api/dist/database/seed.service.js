"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEED_CATALOG = exports.DEFAULT_RESTAURANT_ID = void 0;
exports.seedCatalog = seedCatalog;
exports.DEFAULT_RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const SEED_DATE = new Date('2026-01-01T00:00:00.000Z');
exports.SEED_CATALOG = [
    { _id: '22222222-2222-4222-8222-222222222222', restaurantId: exports.DEFAULT_RESTAURANT_ID, sku: 'BURGER-CLASSIC', name: 'Classic Burger', priceCents: 1250, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
    { _id: '33333333-3333-4333-8333-333333333333', restaurantId: exports.DEFAULT_RESTAURANT_ID, sku: 'PIZZA-MARGHERITA', name: 'Margherita Pizza', priceCents: 1450, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
    { _id: '44444444-4444-4444-8444-444444444444', restaurantId: exports.DEFAULT_RESTAURANT_ID, sku: 'SOUP-SEASONAL', name: 'Seasonal Soup', priceCents: 800, active: false, createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
async function seedCatalog(db) {
    await db.collection('catalog_items').bulkWrite(exports.SEED_CATALOG.map((item) => ({
        updateOne: { filter: { _id: item._id }, update: { $setOnInsert: item }, upsert: true },
    })), { ordered: true });
}
//# sourceMappingURL=seed.service.js.map