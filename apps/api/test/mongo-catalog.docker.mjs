import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { catalogItemSchema } = require('@app/contracts');
const { buildFixtureFilter } = require('./mongo-catalog.fixture.cjs');

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const composeFile = resolve(projectRoot, 'infra/compose.yaml');
const composeArgs = ['compose', '-f', composeFile];
const restaurantId = '11111111-1111-4111-8111-111111111111';
const fixture = {
  _id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  restaurantId,
  sku: 'BLACK-BOX-DUP',
};

function docker(...args) {
  return execFileSync('docker', [...composeArgs, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertRunningTopology() {
  const runningServices = new Set(
    docker('ps', '--services', '--filter', 'status=running')
      .split(/\r?\n/)
      .map((service) => service.trim())
      .filter(Boolean),
  );

  for (const service of ['web', 'api', 'mongodb', 'cassandra']) {
    assert(runningServices.has(service), `Expected ${service} to be running`);
  }
}

async function assertPublicCatalog() {
  const response = await fetch(`http://127.0.0.1:8080/api/catalog?restaurantId=${restaurantId}`);
  assert(response.status === 200, `Expected catalog status 200, received ${response.status}`);

  const catalog = catalogItemSchema.array().parse(await response.json());
  assert(catalog.length === 10, `Expected ten active catalog items, received ${catalog.length}`);
  assert(catalog.every((item) => item.active), 'Catalog response included an inactive item');
  assert(
    catalog.map((item) => `${item.category}:${item.name}:${item.sku}`).join('|') === [...catalog]
      .sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name) || left.sku.localeCompare(right.sku))
      .map((item) => `${item.category}:${item.name}:${item.sku}`).join('|'),
    'Catalog response was not sorted by category, product, and SKU',
  );
}

function assertMongoEnforcement() {
  const script = String.raw`
const db = db.getSiblingDB('restaurant');
const collection = db.getCollection('catalog_items');
const restaurantId = '${restaurantId}';
const now = ISODate('2026-01-01T00:00:00.000Z');
const base = {
  _id: '${fixture._id}',
  restaurantId,
  sku: '${fixture.sku}',
  name: 'Black box item',
  category: 'Brasa',
  description: 'Black box catalog enforcement fixture.',
  imageUrl: null,
  active: true,
  createdAt: now,
  updatedAt: now,
};
const fixtureFilter = ${JSON.stringify(buildFixtureFilter(fixture))};

collection.deleteMany(fixtureFilter);

let invalidRejected = false;
try {
  collection.insertOne({...base, priceCents: '1250'});
} catch (error) {
  invalidRejected = error.code === 121;
}
if (!invalidRejected || collection.countDocuments(fixtureFilter) !== 0) {
  throw new Error('Invalid catalog write was not rejected by the validator');
}

collection.insertOne({...base, priceCents: NumberInt(1250)});
let duplicateRejected = false;
try {
    collection.insertOne({...base, _id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', priceCents: NumberInt(1250)});
} catch (error) {
  duplicateRejected = error.code === 11000;
}
if (!duplicateRejected || collection.countDocuments(fixtureFilter) !== 1) {
  throw new Error('Duplicate catalog write was not rejected by the unique index');
}

collection.deleteMany(fixtureFilter);
print('mongo catalog enforcement: ok');
`;

  const output = docker(
    'exec',
    '-T',
    'mongodb',
    'mongosh',
    '--quiet',
    'mongodb://127.0.0.1:27017/restaurant?replicaSet=rs0',
    '--eval',
    script,
  );
  assert(output.includes('mongo catalog enforcement: ok'), 'Mongo enforcement evidence was not emitted');
}

assertRunningTopology();
assertMongoEnforcement();
await assertPublicCatalog();
console.log('Mongo catalog Docker black-box integration: passed');
