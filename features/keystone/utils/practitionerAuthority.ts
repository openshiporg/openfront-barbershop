import { createHash } from 'node:crypto';
import { isSyntheticAuthority, isLocalAuthorityFixture, localFixtureScopeSql, permittedAuthorityEvidenceSql } from './localFixtureAuthority';

export type PractitionerAuthoritySnapshot = {
  credentialId: string;
  barberId: string;
  serviceId: string;
  shopId: string;
  credentialType: string;
  credentialNumberHash: string;
  issuingAuthority: string;
  jurisdictionCode: string;
  scopeDescription: string;
  evidenceHash: string;
  effectiveFrom: string;
  expiresAt: string;
  verifiedAt: string;
  supervisionRequired: boolean;
  supervisorId: string | null;
  isLocalFixture?: true;
};

type AuthorityRow = {
  id: string;
  barberId: string;
  serviceId: string;
  shopId: string;
  credentialType: string;
  credentialNumber: string;
  issuingAuthority: string;
  jurisdictionCode: string;
  scopeDescription: string;
  evidenceHash: string;
  effectiveFrom: Date;
  expiresAt: Date;
  verifiedAt: Date;
  supervisionRequired: boolean;
  supervisorId: string | null;
  supervisorAuthorized: boolean;
  supervisorUsesFixture?: boolean;
  fixtureAuthorized?: boolean;
};

type RawQueryClient = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
};

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function authoritySnapshot(row: AuthorityRow): PractitionerAuthoritySnapshot {
  const fixture = isSyntheticAuthority(row);
  const usesLocalFixture = fixture || row.supervisorUsesFixture === true;
  if ((fixture && !isLocalAuthorityFixture(row)) || (usesLocalFixture && row.fixtureAuthorized !== true)) {
    throw new Error('Synthetic onboarding records are not practitioner authority.');
  }
  if (!row.jurisdictionCode || !row.scopeDescription || !row.evidenceHash || !row.issuingAuthority) {
    throw new Error('Practitioner authority evidence is incomplete.');
  }
  if (row.supervisionRequired && row.supervisorId === row.barberId) throw new Error('This service requires a different authorized supervising practitioner.');
  if (row.supervisionRequired && (!row.supervisorId || !row.supervisorAuthorized)) {
    throw new Error('This service requires an authorized supervising practitioner.');
  }
  return {
    credentialId: row.id,
    barberId: row.barberId,
    serviceId: row.serviceId,
    shopId: row.shopId,
    credentialType: row.credentialType,
    credentialNumberHash: hash(row.credentialNumber),
    issuingAuthority: row.issuingAuthority,
    jurisdictionCode: row.jurisdictionCode,
    scopeDescription: row.scopeDescription,
    evidenceHash: row.evidenceHash,
    effectiveFrom: row.effectiveFrom.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    verifiedAt: row.verifiedAt.toISOString(),
    supervisionRequired: row.supervisionRequired,
    supervisorId: row.supervisorId,
    ...(usesLocalFixture ? { isLocalFixture: true as const } : {}),
  };
}

export async function requireEffectivePractitionerAuthority(client: RawQueryClient, input: {
  shopId: string;
  barberId: string;
  serviceId: string;
  at: Date;
}) {
  const supervisorEvidence = `FROM "PractitionerCredential" supervisor
    WHERE supervisor."shop" = pc."shop" AND supervisor."barber" = pc."supervisor" AND supervisor."service" = pc."service"
      AND supervisor.id <> pc.id AND supervisor."barber" <> pc."barber"
      AND supervisor.status = 'active' AND supervisor."jurisdictionCode" = pc."jurisdictionCode"
      AND ${permittedAuthorityEvidenceSql('supervisor')}
      AND supervisor."evidenceHash" <> '' AND supervisor."issuingAuthority" <> ''
      AND supervisor."verifiedAt" <= CURRENT_TIMESTAMP AND supervisor."effectiveFrom" <= $4 AND supervisor."expiresAt" > $4`;
  const rows = await client.$queryRawUnsafe<AuthorityRow[]>(`
    SELECT pc.id, pc."barber" AS "barberId", pc."service" AS "serviceId", pc."shop" AS "shopId", pc."credentialType",
      pc."credentialNumber", pc."issuingAuthority", pc."jurisdictionCode", pc."scopeDescription",
      pc."evidenceHash", pc."effectiveFrom", pc."expiresAt", pc."verifiedAt",
      pc."supervisionRequired", pc."supervisor" AS "supervisorId",
      ${localFixtureScopeSql('shop')} AS "fixtureAuthorized",
      CASE WHEN pc."supervisionRequired" = false THEN true ELSE EXISTS (SELECT 1 ${supervisorEvidence}) END AS "supervisorAuthorized",
      CASE WHEN pc."supervisionRequired" = false THEN false ELSE EXISTS (SELECT 1 ${supervisorEvidence} AND supervisor."credentialNumber" LIKE 'DEMO-NOT-A-LICENSE-%') END AS "supervisorUsesFixture"
    FROM "PractitionerCredential" pc
    JOIN "Shop" shop ON shop.id = pc."shop" AND shop."jurisdictionCode" = pc."jurisdictionCode"
    WHERE pc."shop" = $1 AND pc."barber" = $2 AND pc."service" = $3
      AND pc.status = 'active' AND pc."effectiveFrom" <= $4 AND pc."expiresAt" > $4
      AND ${permittedAuthorityEvidenceSql('pc')}
      AND pc."evidenceHash" <> '' AND pc."issuingAuthority" <> ''
      AND pc."verifiedAt" <= CURRENT_TIMESTAMP
    ORDER BY pc."verifiedAt" DESC, pc."effectiveFrom" DESC
    LIMIT 2
  `, input.shopId, input.barberId, input.serviceId, input.at);
  const row = rows[0];
  if (!row) throw new Error('The selected practitioner has no effective credential for this service and shop jurisdiction.');
  if (rows.length > 1) throw new Error('Practitioner authority is ambiguous because multiple credentials are effective for this service time.');
  return authoritySnapshot(row);
}

export function assertAuthorityMatches(snapshot: PractitionerAuthoritySnapshot, input: { shopId: string; barberId: string; serviceId: string; at: Date }) {
  if (snapshot.shopId !== input.shopId || snapshot.barberId !== input.barberId || snapshot.serviceId !== input.serviceId) {
    throw new Error('Practitioner authority evidence does not match this appointment.');
  }
  if (new Date(snapshot.effectiveFrom) > input.at || new Date(snapshot.expiresAt) <= input.at) {
    throw new Error('Practitioner authority evidence is not effective for this service time.');
  }
}
