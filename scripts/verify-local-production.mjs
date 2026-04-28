import { spawnSync } from 'node:child_process';

const commands = [
  ['npm', ['test']],
  ['npm', ['run', 'build']],
  ['npm', ['run', 'db:check']],
  ['npm', ['run', 'rehearse:local-production']],
  ['npm', ['run', 'test:e2e']]
];

for (const [command, args] of commands) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const [executable, executableArgs] =
    process.platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', command, ...args]] : [command, args];
  const result = spawnSync(executable, executableArgs, {
    stdio: 'inherit'
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
