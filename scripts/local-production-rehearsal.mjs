import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = await mkdtemp(join(tmpdir(), 'ai-novel-local-production-'));

try {
  run('npx', ['vitest', 'run', 'apps/api/src/test/local-production-rehearsal.test.ts'], {
    AI_NOVEL_REHEARSAL_ROOT: root
  });
} finally {
  await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

function run(command, args, env = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const [executable, executableArgs] =
    process.platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', command, ...args]] : [command, args];
  const result = spawnSync(executable, executableArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env
    }
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
