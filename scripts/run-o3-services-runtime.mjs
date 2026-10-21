import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertO3GeneratedArtifacts,
  createO3ServicesChildEnvironment,
  validateO3ServicesRuntimeTarget,
} from './o3ServicesRuntimeGuard.mjs';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

try {
  if (process.env.NODE_OPTIONS?.trim()) {
    throw new Error('O3 runtime entrypoint requires NODE_OPTIONS unset; use `env -u NODE_OPTIONS` so preloads cannot initialize dotenv/app context before the target fence.');
  }
  if (!process.argv.includes('--confirm-isolated-o3-db')) {
    throw new Error('O3 runtime test requires the explicit --confirm-isolated-o3-db command-line opt-in.');
  }

  // This target fence runs before loading dotenv, Keystone, Context, or Prisma.
  const target = validateO3ServicesRuntimeTarget(process.env);
  const schemaPath = join(projectRoot, 'schema.graphql');
  const prismaClientPath = join(projectRoot, 'node_modules/.prisma/client/index.js');
  const integrationTestPath = join(projectRoot, 'features/keystone/utils/__tests__/serviceCatalogAuthorization.integration.test.ts');
  if (!existsSync(schemaPath)) throw new Error('O3 generated-contract prerequisite failed: schema.graphql is missing.');
  if (!existsSync(integrationTestPath)) throw new Error('O3 runtime prerequisite failed: service-catalog integration test is missing.');
  const declarationPath = join(projectRoot, 'node_modules/.prisma/client/index.d.ts');
  assertO3GeneratedArtifacts(readFileSync(schemaPath, 'utf8'), existsSync(prismaClientPath), existsSync(declarationPath) ? readFileSync(declarationPath, 'utf8') : '');

  console.log(`O3 runtime target accepted: ${target.databaseName}; no migration or database creation will be attempted.`);
  const childEnv = createO3ServicesChildEnvironment(process.env, target.databaseUrl);
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', '--test', '--test-concurrency=1',
    'features/keystone/utils/__tests__/serviceCatalogAuthorization.integration.test.ts',
  ], { cwd: projectRoot, env: childEnv, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`O3 runtime prerequisite failure: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
