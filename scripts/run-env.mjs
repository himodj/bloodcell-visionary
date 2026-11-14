// Runs a command with extra environment variables (works the same on Windows, macOS and Linux).
// Usage: node scripts/run-env.mjs NAME=value [NAME=value ...] command [args...]
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const env = { ...process.env };
while (args.length && /^[A-Z0-9_]+=/.test(args[0])) {
  const [name, ...rest] = args.shift().split('=');
  env[name] = rest.join('=');
}
const result = spawnSync(args[0], args.slice(1), { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
