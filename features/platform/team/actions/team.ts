'use server';

import { revalidatePath } from 'next/cache';
import { platformCommand, platformRequest } from '@/features/platform/lib/platformRequest';

export type TeamMember = { id: string; membershipRole: string; status: string; createdAt: string; user: { id: string; name: string | null; email: string | null; barberProfile: { id: string; displayName: string } | null } | null };
export type TeamData = { selfId: string | null; memberships: TeamMember[] };

export async function getTeamAction(): Promise<{ ok: true; data: TeamData } | { ok: false; error: string }> {
  const result = await platformRequest<{ platformTeam: { success: boolean; error: string | null; data: TeamData | null } }>('query { platformTeam { success error data } }');
  if (!result.ok) return { ok: false, error: result.error };
  const team = result.data.platformTeam;
  return team.success && team.data ? { ok: true, data: team.data } : { ok: false, error: team.error || 'Unable to load the team.' };
}

const refresh = () => { revalidatePath('/dashboard/platform/team'); revalidatePath('/dashboard/platform/staff'); };

export async function addMemberAction(form: FormData) {
  const result = await platformCommand(`mutation($email: String!, $role: String!) { addShopMemberByEmail(email: $email, membershipRole: $role) { success error data } }`,
    { email: String(form.get('email') || ''), role: String(form.get('membershipRole') || 'viewer') }, 'addShopMemberByEmail');
  if (result.success) refresh();
  return result;
}

export async function setMemberRoleAction(id: string, membershipRole: string) {
  const result = await platformRequest(`mutation($id: ID!, $role: ShopMembershipMembershipRoleType) { updateShopMembership(where: { id: $id }, data: { membershipRole: $role }) { id } }`, { id, role: membershipRole });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  return { success: true };
}

export async function setMemberStatusAction(id: string, status: string) {
  if (!['active', 'suspended', 'revoked'].includes(status)) return { success: false, error: 'Choose a status.' };
  const result = await platformRequest(`mutation($id: ID!, $status: ShopMembershipStatusType) { updateShopMembership(where: { id: $id }, data: { status: $status }) { id } }`, { id, status });
  if (!result.ok) return { success: false, error: result.error };
  refresh();
  return { success: true };
}
