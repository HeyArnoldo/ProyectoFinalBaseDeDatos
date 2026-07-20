import { Db } from 'mongodb';

export const DEFAULT_RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const SEED_DATE = new Date('2026-01-01T00:00:00.000Z');

export const SEED_CATALOG = [
  { _id: '22222222-2222-4222-8222-222222222222', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'POLLO-MEDIO', name: 'Medio pollo a la brasa', category: 'Brasa', description: 'Pollo marinado con especias de la casa, papas doradas y cremas artesanales.', imageUrl: null, priceCents: 1250, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: '33333333-3333-4333-8333-333333333333', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'COMBO-CLASICO', name: 'Combo clásico', category: 'Combos', description: 'Medio pollo a la brasa, papas doradas y chicha morada de la casa.', imageUrl: null, priceCents: 1450, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: '44444444-4444-4444-8444-444444444444', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'SOPA-CRIOLLA', name: 'Sopa criolla', category: 'Guarniciones', description: 'Receta de temporada con fondo casero y hierbas frescas.', imageUrl: null, priceCents: 800, active: false, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: '55555555-5555-4555-8555-555555555555', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'POLLO-CUARTO', name: 'Cuarto de pollo a la brasa', category: 'Brasa', description: 'Porción ligera de pollo al carbón con papas y ensalada fresca.', imageUrl: null, priceCents: 890, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: '66666666-6666-4666-8666-666666666666', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'POLLO-ENTERO', name: 'Pollo entero a la brasa', category: 'Brasa', description: 'Pollo entero al carbón para compartir, con papas y cuatro cremas.', imageUrl: null, priceCents: 2390, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: '77777777-7777-4777-8777-777777777777', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'ANTICUCHOS-RES', name: 'Anticuchos de res', category: 'Brasa', description: 'Brochetas de res marinadas, cocidas a la brasa y acompañadas de choclo.', imageUrl: null, priceCents: 1190, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: '88888888-8888-4888-8888-888888888888', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'COMBO-FAMILIAR', name: 'Combo familiar', category: 'Combos', description: 'Pollo entero, papas familiares, ensalada y una jarra de chicha morada.', imageUrl: null, priceCents: 4290, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: '99999999-9999-4999-8999-999999999999', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'COMBO-EJECUTIVO', name: 'Combo ejecutivo', category: 'Combos', description: 'Cuarto de pollo, guarnición del día y bebida para una pausa completa.', imageUrl: null, priceCents: 1690, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'PAPAS-DORADAS', name: 'Papas doradas', category: 'Guarniciones', description: 'Papas crocantes sazonadas con sal de hierbas y limón.', imageUrl: null, priceCents: 690, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'ENSALADA-CASA', name: 'Ensalada de la casa', category: 'Guarniciones', description: 'Hojas frescas, tomate, pepino y vinagreta de ají amarillo.', imageUrl: null, priceCents: 790, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'CHICHA-MORADA', name: 'Chicha morada', category: 'Bebidas', description: 'Refresco peruano de maíz morado, piña y especias.', imageUrl: null, priceCents: 550, active: true, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { _id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', restaurantId: DEFAULT_RESTAURANT_ID, sku: 'LIMONADA-HIERBALUISA', name: 'Limonada de hierbaluisa', category: 'Bebidas', description: 'Limonada fresca infusionada con hierbaluisa y un toque de miel.', imageUrl: null, priceCents: 550, active: false, createdAt: SEED_DATE, updatedAt: SEED_DATE },
] as const;

type CatalogSeed = (typeof SEED_CATALOG)[number];

export async function seedCatalog(db: Db): Promise<void> {
  await db.collection<CatalogSeed>('catalog_items').bulkWrite(
    SEED_CATALOG.map((item) => ({
      replaceOne: { filter: { _id: item._id }, replacement: item, upsert: true },
    })),
    { ordered: true },
  );
}
