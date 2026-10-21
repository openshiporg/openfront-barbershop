/** Existing onboarding fixtures are data, not a licensing approval or an
 * admission bypass. They may satisfy ordinary checks only in the disposable
 * local/offline contract; moving a fixture into a merchant target fails closed.
 */
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

export type FixtureQueryClient = { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> };
export const FIXTURE_ISSUER = 'DEMO ONLY — onboarding authority fixture; not a licensing authority';

type FixtureEvidence = { credentialNumber: string; issuingAuthority: string; scopeDescription: string; evidenceHash: string };
export function isSyntheticAuthority(row: FixtureEvidence) {
  return /^DEMO-NOT-A-LICENSE-/i.test(row.credentialNumber) || /^DEMO ONLY/i.test(row.issuingAuthority) || /not (?:a licensing authority|legal credential proof)/i.test(row.scopeDescription);
}
export function isLocalAuthorityFixture(row: FixtureEvidence) {
  return /^DEMO-NOT-A-LICENSE-[A-F0-9]{12}$/.test(row.credentialNumber) && row.issuingAuthority === FIXTURE_ISSUER && /^DEMO ONLY — seeded authority for .+; not legal credential proof$/.test(row.scopeDescription) && /^[a-f0-9]{64}$/.test(row.evidenceHash);
}

export function isDisposableLocalFixtureTarget(target: { host: string; dbName: string }) {
  return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(target.host) && /^runtime_barbershop_(?:verify|ephemeral)_[a-z0-9_]+$/.test(target.dbName);
}

/** Private runtime ownership facts, not permission to bypass admission. No
 * credentials are stored here; actual PG identity must independently match. */
function localOwnership() {
  try {
    const file = resolve(process.env.BARBERSHOP_FIXTURE_OWNERSHIP_PATH || '');
    const runtime = realpathSync(join(process.cwd(), '.runtime')) + sep;
    const stat = lstatSync(file);
    if (!file.startsWith(runtime) || realpathSync(file) !== file || !stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o600 || stat.size > 65536) return null;
    const value = JSON.parse(readFileSync(file, 'utf8'));
    if (value.version !== 1 || value.root !== dirname(file) || value.datadir !== join(value.root, 'pgdata') || typeof value.role !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(value.role) || !Array.isArray(value.databases) || value.databases.length === 0 || value.databases.length > 64 || !value.databases.every((name: unknown) => typeof name === 'string' && /^[a-z0-9_]+$/.test(name))) return null;
    const data = lstatSync(value.datadir);
    if (!data.isDirectory() || data.isSymbolicLink() || data.uid !== stat.uid || realpathSync(value.datadir) !== value.datadir) return null;
    return value as { role: string; datadir: string; databases: string[] };
  } catch { return null; }
}

/** Aliases are internal constants, never caller input. Private owned-runtime
 * facts AND actual PG identity are required; ordinary evidence needs neither. */
export function localFixtureScopeSql(shop: 'shop' | 's') {
  const ownership = localOwnership();
  if (!ownership) return 'FALSE';
  const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
  return `(${shop}."isDemo" = true
    AND current_database() IN (${ownership.databases.map(literal).join(',')})
    AND current_user = ${literal(ownership.role)} AND session_user = ${literal(ownership.role)}
    AND (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()) = current_user
    AND CASE WHEN (SELECT rolsuper OR pg_has_role(current_user, 'pg_read_all_settings', 'USAGE') FROM pg_roles WHERE rolname = current_user)
      THEN current_setting('data_directory', true) = ${literal(ownership.datadir)} ELSE false END
    AND current_database() ~ '^runtime_barbershop_(verify|ephemeral)_[a-z0-9_]+$'
    AND inet_server_addr() IN ('127.0.0.1'::inet, '::1'::inet)
    AND NOT EXISTS (SELECT 1 FROM "PaymentProvider" fixture_provider WHERE fixture_provider."shop" = ${shop}.id AND fixture_provider."isInstalled" = true AND fixture_provider.code <> 'pp_manual'))`;
}

export function permittedAuthorityEvidenceSql(alias: 'pc' | 'supervisor') {
  const synthetic = `(${alias}."credentialNumber" ILIKE 'DEMO-NOT-A-LICENSE-%' OR ${alias}."issuingAuthority" ILIKE 'DEMO ONLY%' OR ${alias}."scopeDescription" ~* 'not (a licensing authority|legal credential proof)')`;
  const fixture = `(${alias}."credentialNumber" ~ '^DEMO-NOT-A-LICENSE-[A-F0-9]{12}$' AND ${alias}."issuingAuthority" = '${FIXTURE_ISSUER}' AND ${alias}."scopeDescription" ~ '^DEMO ONLY — seeded authority for .+; not legal credential proof$' AND ${alias}."evidenceHash" ~ '^[a-f0-9]{64}$')`;
  return `(NOT ${synthetic} OR (${fixture} AND ${localFixtureScopeSql('shop')}))`;
}

export async function isLocalFixtureShop(client: FixtureQueryClient, shopId: string) {
  const [row] = await client.$queryRawUnsafe<Array<{ allowed: boolean }>>(`SELECT ${localFixtureScopeSql('s')} AS allowed FROM "Shop" s WHERE s.id = $1`, shopId);
  return row?.allowed === true;
}
