import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '../../..');
const composePath = resolve(projectRoot, 'infra/compose.yaml');

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

function readService(compose: string, service: string): string {
  const match = compose.match(
    new RegExp(
      `^  ${service}:\\r?\\n([\\s\\S]*?)(?=^  (?:web|api|mongodb|cassandra):|^volumes:|^networks:)`,
      'm',
    ),
  );

  if (!match) {
    throw new Error(`Missing Compose service: ${service}`);
  }

  return match[0];
}

describe('local runtime topology', () => {
  it('declares exactly four memory-bounded services and private databases', () => {
    const compose = readProjectFile('infra/compose.yaml');
    const serviceSection = compose.match(/^services:\r?\n([\s\S]*?)(?=^volumes:)/m)?.[1] ?? '';
    const serviceNames = [...serviceSection.matchAll(/^  ([a-z]+):\r?$/gm)].map(
      ([, service]) => service,
    );

    expect(serviceNames).toEqual(['web', 'api', 'mongodb', 'cassandra']);

    const expectedMemory = {
      web: '96m',
      api: '384m',
      mongodb: '1536m',
      cassandra: '3072m',
    };

    for (const [service, memory] of Object.entries(expectedMemory)) {
      expect(readService(compose, service)).toContain(`mem_limit: ${memory}`);
    }

    expect(readService(compose, 'web')).toContain('- "8080:80"');
    expect(readService(compose, 'api')).not.toMatch(/^    ports:/m);
    expect(readService(compose, 'mongodb')).not.toMatch(/^    ports:/m);
    expect(readService(compose, 'cassandra')).not.toMatch(/^    ports:/m);
    expect(compose).not.toMatch(/^  worker:/m);
  });

  it('declares health-gated recovery, persistent volumes, and real database readiness checks', () => {
    const compose = readProjectFile('infra/compose.yaml');
    const requiredServices = ['web', 'api', 'mongodb', 'cassandra'];

    for (const service of requiredServices) {
      const block = readService(compose, service);
      expect(block).toContain('restart: unless-stopped');
      expect(block).toContain('driver: json-file');
      expect(block).toContain('max-size: 10m');
      expect(block).toMatch(/max-file: ["']?3/);
    }

    expect(readService(compose, 'web')).toMatch(/api:\s*\n\s+condition: service_healthy/);
    expect(readService(compose, 'api')).toMatch(
      /mongodb:\s*\n\s+condition: service_healthy[\s\S]*cassandra:\s*\n\s+condition: service_healthy/,
    );
    expect(readService(compose, 'mongodb')).toContain('mongodb_data:/data/db');
    expect(readService(compose, 'cassandra')).toContain(
      'cassandra_data:/var/lib/cassandra',
    );
    expect(readService(compose, 'api')).toContain('- api');
    expect(readService(compose, 'mongodb')).toContain('- mongodb');
    expect(readService(compose, 'cassandra')).toContain('- cassandra');

    expect(readProjectFile('infra/mongodb/healthcheck.js')).toContain(
      'replSetInitiate',
    );
    expect(readProjectFile('infra/mongodb/healthcheck.js')).toContain(
      'replSetGetStatus',
    );
    expect(readService(compose, 'cassandra')).toMatch(/cqlsh[\s\S]*SELECT release_version/);
    expect(compose).not.toMatch(/^    internal: true$/m);
  });

  it('declares multi-stage images and deterministic web/API health paths', () => {
    const apiDockerfile = readProjectFile('apps/api/Dockerfile');
    const webDockerfile = readProjectFile('apps/web/Dockerfile');
    const nginx = readProjectFile('apps/web/nginx.conf');

    expect(apiDockerfile).toMatch(/FROM node:22-alpine AS base/);
    expect(apiDockerfile).toMatch(/FROM base AS build/);
    expect(apiDockerfile).toMatch(/FROM base AS runtime/);
    expect(apiDockerfile).toContain('COPY apps/api/src apps/api/src');
    expect(apiDockerfile).not.toContain('COPY apps/api apps/api');
    expect(webDockerfile).toMatch(/FROM node:22-alpine AS build/);
    expect(webDockerfile).toMatch(/FROM nginx:.* AS runtime/);
    expect(webDockerfile).toContain('COPY apps/web/src apps/web/src');
    expect(webDockerfile).not.toContain('COPY apps/web apps/web');
    expect(nginx).toContain('location /api/');
    expect(nginx).toContain('proxy_pass http://api:3000;');
    expect(nginx).toContain('location = /api/health');
    expect(nginx).toContain('proxy_pass http://api:3000/health;');
    expect(nginx).toContain('location = /health');
  });
});
