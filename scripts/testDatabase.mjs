import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const url = new URL(process.env.DATABASE_URL || 'invalid:');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/runtime_barbershop_ephemeral_[a-zA-Z0-9_]+$/.test(url.pathname)) {
  throw new Error('Database tests require a LOCAL disposable runtime_barbershop_ephemeral_* database. Maintained databases are refused.');
}
function tests(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? tests(join(dir, entry.name)) : entry.name.endsWith('.test.ts') ? [join(dir, entry.name)] : []); }
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...tests('features')], { stdio: 'inherit', env: { ...process.env, RUN_DATABASE_TESTS: '1' } });
process.exitCode = result.status ?? 1;
