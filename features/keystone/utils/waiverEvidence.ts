import { createHash } from 'node:crypto';
import { publicAccessTokenMatches } from './publicAccessToken';

export type WaiverRequirement = {
  required: boolean;
  templateKey: string;
  templateVersion: string;
  templateText: string;
  templateHash: string;
};

type RawQueryClient = { $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T> };

export function hashWaiverText(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

export async function getWaiverRequirement(client: RawQueryClient, serviceId: string): Promise<WaiverRequirement> {
  const rows = await client.$queryRawUnsafe<Array<{ waiverRequired: boolean; waiverTemplateKey: string | null; waiverTemplateVersion: string | null; waiverTemplateText: string | null; waiverTemplateHash: string | null }>>(`
    SELECT "waiverRequired", "waiverTemplateKey", "waiverTemplateVersion", "waiverTemplateText", "waiverTemplateHash"
    FROM "Service" WHERE id = $1 LIMIT 1
  `, serviceId);
  const row = rows[0];
  if (!row?.waiverRequired) return { required: false, templateKey: '', templateVersion: '', templateText: '', templateHash: '' };
  const computedHash = hashWaiverText(row.waiverTemplateText || '');
  if (!row.waiverTemplateKey || !row.waiverTemplateVersion || !row.waiverTemplateText || !row.waiverTemplateHash || computedHash !== row.waiverTemplateHash) {
    throw new Error('This service requires a valid immutable waiver template before it can be booked or started.');
  }
  return { required: true, templateKey: row.waiverTemplateKey, templateVersion: row.waiverTemplateVersion, templateText: row.waiverTemplateText, templateHash: row.waiverTemplateHash };
}

export async function getAppointmentWaiverRequirement(client: RawQueryClient, appointmentId: string): Promise<WaiverRequirement> {
  const rows = await client.$queryRawUnsafe<Array<{ requirement: WaiverRequirement | null }>>('SELECT "waiverRequirementSnapshot" AS requirement FROM "Appointment" WHERE id = $1 LIMIT 1', appointmentId);
  const requirement = rows[0]?.requirement;
  if (!requirement || typeof requirement.required !== 'boolean') throw new Error('Appointment waiver requirement evidence is missing.');
  if (requirement.required && (!requirement.templateKey || !requirement.templateVersion || !requirement.templateText || hashWaiverText(requirement.templateText) !== requirement.templateHash)) {
    throw new Error('Appointment waiver template evidence is invalid.');
  }
  return requirement;
}

export async function requireSignedWaiver(client: RawQueryClient, input: { appointmentId: string; serviceId: string; customerId: string; templateHash: string }) {
  const rows = await client.$queryRawUnsafe<Array<{ id: string }>>(`
    SELECT id FROM "WaiverForm"
    WHERE "appointment" = $1 AND "service" = $2 AND "customer" = $3
      AND status = 'signed' AND "templateHash" = $4 AND "affirmationHash" IS NOT NULL
      AND "signedAt" IS NOT NULL
    ORDER BY "signedAt" DESC LIMIT 1
  `, input.appointmentId, input.serviceId, input.customerId, input.templateHash);
  if (!rows[0]) throw new Error('A signer-controlled waiver is required before this service can start.');
  return rows[0].id;
}

export function assertWaiverSigner(input: { signerName: string; signerRole: string; guardianName?: string | null; affirmation: boolean }) {
  const signerName = input.signerName.trim();
  if (!input.affirmation || signerName.length < 2 || signerName.length > 160) throw new Error('Signer name and affirmative consent are required.');
  if (!['customer', 'guardian'].includes(input.signerRole)) throw new Error('Signer role must be customer or guardian.');
  const guardianName = input.guardianName?.trim() || '';
  if (input.signerRole === 'guardian' && guardianName.length < 2) throw new Error('Guardian authority name is required.');
  return { signerName, signerRole: input.signerRole, guardianName };
}

export function assertAppointmentOwnerToken(token: string, storedHash?: string | null) {
  if (!token.trim() || !publicAccessTokenMatches(token.trim(), storedHash)) throw new Error('Appointment access proof is invalid.');
}

/**
 * Account-owned bookings are opened by their current signed-in owner only; the
 * booking-time token alone does not reach them. Guest bookings need their token.
 */
export function canAccessAppointment(input: { token?: string | null; storedHash?: string | null; accountId?: string | null; sessionItemId?: string | null }) {
  if (input.accountId) return Boolean(input.sessionItemId) && input.sessionItemId === input.accountId;
  const token = input.token?.trim() || '';
  return Boolean(token) && publicAccessTokenMatches(token, input.storedHash);
}

export function assertAppointmentAccess(input: Parameters<typeof canAccessAppointment>[0]) {
  if (!canAccessAppointment(input)) throw new Error(input.accountId ? 'Sign in to the account that made this booking to manage it.' : 'Appointment access proof is invalid.');
}
