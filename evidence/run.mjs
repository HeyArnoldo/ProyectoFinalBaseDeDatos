import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const configuredRunId = process.env.EVIDENCE_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
const runId = configuredRunId.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'runtime';
const output = resolve(root, 'evidence', runId);
const composeCommand = 'docker compose --project-directory . -p infra -f infra/compose.yaml';
const declaredCommands = [
  { name: 'focusedWebTests', command: 'pnpm --filter @app/web run test' },
  { name: 'fullTests', command: 'pnpm test' },
  { name: 'typecheck', command: 'pnpm typecheck' },
  { name: 'build', command: 'pnpm build' },
  { name: 'dockerCatalog', command: 'pnpm test:docker' },
  { name: 'e2e', command: 'pnpm test:e2e', env: { E2E_ALLOW_MUTATION: '1', EVIDENCE_DIR: output } },
  { name: 'diffCheck', command: 'git diff --check' },
  { name: 'composeTopology', command: `${composeCommand} ps --format json` },
  { name: 'composeServices', command: `${composeCommand} config --services` },
  { name: 'composeStats', command: `${composeCommand} stats --no-stream --format json` },
];

mkdirSync(output, { recursive: true });

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sanitizeCommand(command) {
  return command
    .replaceAll(root, '<workspace>')
    .replace(/[A-Za-z]:[\\/][^\s]*/g, '<path>')
    .replace(/\/\/[^\s]+/g, '<path>')
    .replace(/\s+/g, ' ')
    .trim();
}

function execute(name, command, extraEnv = {}) {
  const started = Date.now();
  const windows = process.platform === 'win32';
  const executable = windows ? 'cmd.exe' : 'sh';
  const args = windows ? ['/d', '/s', '/c', command] : ['-lc', command];
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...extraEnv } });
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  return {
    name,
    command: sanitizeCommand(command),
    exitCode: typeof result.status === 'number' ? result.status : 1,
    durationMs: Date.now() - started,
    stdoutHash: hash(stdout),
    stderrHash: hash(stderr),
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: Buffer.byteLength(stderr),
    spawnError: Boolean(result.error),
    stdout,
  };
}

function gitFileList() {
  const result = spawnSync('git', ['ls-files', '-m', '-o', '--exclude-standard', '-z'], { cwd: root, encoding: 'buffer' });
  if (result.status !== 0) return [];
  return result.stdout.toString('utf8').split('\0').map((value) => value.replaceAll('\\', '/')).filter(Boolean);
}

function isImplementationFile(file) {
  if (file === 'evidence/run.mjs') return true;
  if (file.startsWith('evidence/')) return false;
  if (/(^|\/)(dist|coverage|test-results|playwright-report|reports|build)(\/|$)/.test(file)) return false;
  if (file.startsWith('docs/') || file.startsWith('openspec/')) return false;
  return file.startsWith('apps/') || file.startsWith('packages/') || file.startsWith('infra/') || ['.gitignore', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file);
}

function collectContentProvenance() {
  const files = gitFileList().filter(isImplementationFile).sort();
  const entries = files.map((file) => {
    const absolute = resolve(root, file);
    const present = existsSync(absolute);
    return { path: file, sha256: present ? hash(readFileSync(absolute)) : null };
  });
  return { files: entries, hash: hash(JSON.stringify(entries)) };
}

function collectUiArtifacts() {
  const uiDirectory = resolve(output, 'ui');
  if (!existsSync(uiDirectory)) return { files: [], hash: hash('[]') };
  const files = readdirSync(uiDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const path = `ui/${name}`;
      return { path, sha256: hash(readFileSync(resolve(output, path))) };
    });
  return { files, hash: hash(JSON.stringify(files)) };
}

function publicResult(result) {
  const { stdout: _stdout, ...safe } = result;
  return safe;
}

function parseJsonLines(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  }
}

function sanitizeServiceName(value) {
  const known = new Set(['web', 'api', 'mongodb', 'cassandra']);
  if (known.has(value)) return value;
  return [...known].find((service) => value.includes(`-${service}-`) || value.startsWith(`${service}-`)) ?? null;
}

function sanitizeTopology(psResult, statsResult, configuredResult) {
  const services = parseJsonLines(psResult.stdout).flatMap((container) => {
    if (!container || typeof container !== 'object') return [];
    const service = sanitizeServiceName(String(container.Service ?? container.service ?? container.Name ?? ''));
    if (!service) return [];
    return [{
      service,
      image: String(container.Image ?? container.image ?? '').replace(/[^a-zA-Z0-9_.:/-]/g, ''),
      state: String(container.State ?? container.state ?? '').toLowerCase() === 'running' ? 'running' : 'not-running',
      health: String(container.Health ?? container.health ?? '').toLowerCase() || 'unknown',
      status: String(container.Status ?? container.status ?? '').replace(/\b[0-9a-f]{12,64}\b/gi, '<id>'),
      ports: String(container.Ports ?? container.ports ?? '').replace(/[A-Za-z]:[\\/][^\s,]*/g, '<path>'),
    }];
  });
  const dockerStats = parseJsonLines(statsResult.stdout).flatMap((stat) => {
    if (!stat || typeof stat !== 'object') return [];
    const service = sanitizeServiceName(String(stat.Name ?? stat.name ?? stat.Service ?? stat.service ?? ''));
    if (!service) return [];
    return [{
      service,
      cpu: String(stat.CPUPerc ?? stat.cpu ?? '').replace(/[^0-9.% -]/g, ''),
      memory: String(stat.MemUsage ?? stat.memory ?? '').replace(/[^0-9A-Za-z.% /-]/g, ''),
      memoryPercent: String(stat.MemPerc ?? stat.memoryPercent ?? '').replace(/[^0-9.% -]/g, ''),
      pids: String(stat.PIDs ?? stat.pids ?? '').replace(/[^0-9]/g, ''),
    }];
  });
  const configuredServices = configuredResult.stdout.split(/\r?\n/).map((service) => sanitizeServiceName(service.trim())).filter(Boolean);
  const uniqueServices = [...new Set(services.map((service) => service.service))];
  const healthyServices = services.filter((service) => service.state === 'running' && ['healthy', ''].includes(service.health)).map((service) => service.service);
  return {
    project: 'infra',
    composeFile: 'infra/compose.yaml',
    configuredServices: [...new Set(configuredServices)],
    services,
    dockerStats,
    expectedServiceCount: 4,
    runningServiceCount: uniqueServices.length,
    healthyServiceCount: [...new Set(healthyServices)].length,
    healthy: uniqueServices.length === 4 && [...new Set(healthyServices)].length === 4,
  };
}

function write(name, value) {
  writeFileSync(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
}

const commandResults = declaredCommands.map(({ name, command, env }) => execute(name, command, env));
const resultByName = new Map(commandResults.map((result) => [result.name, result]));
const topology = sanitizeTopology(resultByName.get('composeTopology'), resultByName.get('composeStats'), resultByName.get('composeServices'));
const statusResult = execute('gitStatusProvenance', 'git status --porcelain=v1');
const diffResult = execute('gitDiffProvenance', 'git diff --no-ext-diff --binary');
const stagedDiffResult = execute('gitStagedDiffProvenance', 'git diff --cached --no-ext-diff --binary');
const commitResult = execute('gitCommitProvenance', 'git rev-parse --short HEAD');
const contentProvenance = collectContentProvenance();
const uiArtifacts = collectUiArtifacts();
const verificationPassed = commandResults.every((result) => result.exitCode === 0);
const provenancePassed = [statusResult, diffResult, stagedDiffResult, commitResult].every((result) => result.exitCode === 0);
const runPassed = verificationPassed && provenancePassed && topology.healthy;

write('manifest.json', {
  schemaVersion: 2,
  runId,
  generatedAt: new Date().toISOString(),
  commit: commitResult.exitCode === 0 ? commitResult.stdout.trim().slice(0, 12) : null,
  node: process.version,
  project: 'infra',
  composeFile: 'infra/compose.yaml',
  commands: commandResults.map(publicResult),
  provenance: {
    dirty: statusResult.stdout.length > 0,
    statusHash: statusResult.stdoutHash,
    diffHash: diffResult.stdoutHash,
    stagedDiffHash: stagedDiffResult.stdoutHash,
    contentHash: contentProvenance.hash,
    contentFiles: contentProvenance.files,
    provenanceCommandsPassed: provenancePassed,
  },
  uiArtifacts,
});
write('topology.json', topology);
write('outcomes.json', {
  schemaVersion: 2,
  passed: runPassed,
  outcomes: Object.fromEntries(commandResults.map((result) => [result.name, { passed: result.exitCode === 0, exitCode: result.exitCode, durationMs: result.durationMs }])),
  topology: { healthy: topology.healthy, healthyServiceCount: topology.healthyServiceCount, expectedServiceCount: topology.expectedServiceCount },
  provenance: { passed: provenancePassed, dirty: statusResult.stdout.length > 0, diffHash: diffResult.stdoutHash, contentHash: contentProvenance.hash },
  uiArtifacts,
  note: 'Derived from executed commands. Only sanitized command metadata and stdout/stderr hashes are persisted.',
});

console.log(relative(root, output).replaceAll('\\', '/'));
if (!runPassed) process.exitCode = 1;
