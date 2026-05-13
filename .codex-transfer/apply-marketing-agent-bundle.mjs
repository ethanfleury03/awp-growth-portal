#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const dir = dirname(fileURLToPath(import.meta.url));
const bundlePath = join(dir, 'marketing-agent.bundle');
const targetBranch = 'codex/marketing-agent-workspace-full';
const expectedHead = '7f88b19a95edc54595bea3de18bdc347a105af06';
const partPrefix = 'marketing-agent.bundle.b64.v2.part-';

const parts = readdirSync(dir)
  .filter((name) => name.startsWith(partPrefix))
  .sort();

if (!parts.length) {
  console.error(`No ${partPrefix} files found in .codex-transfer.`);
  process.exit(1);
}

const encoded = parts.map((name) => readFileSync(join(dir, name), 'utf8')).join('');
writeFileSync(bundlePath, Buffer.from(encoded, 'base64'));

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('git', ['bundle', 'verify', bundlePath]);
run('git', ['fetch', bundlePath, `HEAD:refs/heads/${targetBranch}`]);
run('git', ['switch', targetBranch]);

const rev = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
if (rev.status === 0 && rev.stdout.trim() !== expectedHead) {
  console.warn(`Restored branch HEAD is ${rev.stdout.trim()}, expected ${expectedHead}.`);
}

console.log(`Restored Marketing Agent work on ${targetBranch}.`);
