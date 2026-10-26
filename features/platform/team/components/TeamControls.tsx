'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { DrawerForm, Field } from '@/features/platform/lib/forms';
import { selectClass } from '@/features/platform/lib/ui';
import { RowMenu, statusItems } from '@/features/platform/records/lib/controls';
import { addMemberAction, setMemberRoleAction, setMemberStatusAction, type TeamMember } from '../actions/team';

import { ROLE_LABELS } from '../lib/roles';

function RoleSelect({ id, name, defaultValue, onChange, disabled, label }: { id: string; name?: string; defaultValue: string; onChange?: (value: string) => void; disabled?: boolean; label?: string }) {
  return (
    <select id={id} name={name} aria-label={label} defaultValue={defaultValue} disabled={disabled} onChange={(event) => onChange?.(event.target.value)} className={`${selectClass} w-36`}>
      {Object.entries(ROLE_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
  );
}

export function AddMemberButton() {
  return (
    <DrawerForm trigger="Invite member" triggerVariant="primary" title="Invite a team member" description="Someone without an account gets an email to set a password." action={addMemberAction} submitLabel="Invite">
      <Field id="member-email" label="Account email" wide><Input id="member-email" name="email" type="email" required maxLength={254} autoComplete="off" className="h-9 rounded-[6px]" /></Field>
      <Field id="member-role" label="Role"><RoleSelect id="member-role" name="membershipRole" defaultValue="barber" /></Field>
    </DrawerForm>
  );
}

/** Role, changed in place from the table cell. */
export function MemberRole({ member }: { member: TeamMember }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const changeRole = (role: string) => {
    setError(null);
    startTransition(async () => {
      const result = await setMemberRoleAction(member.id, role);
      if (!result.success) setError(result.error || 'The role couldn’t be changed.');
      router.refresh();
    });
  };
  return (
    <span className="inline-grid gap-1">
      <RoleSelect id={`role-${member.id}`} label={`Role for ${member.user?.name || member.user?.email || 'member'}`} defaultValue={member.membershipRole} onChange={changeRole} disabled={pending || member.status === 'revoked'} />
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

export function MemberMenu({ member, self }: { member: TeamMember; self: boolean }) {
  if (self) return null;
  const options = member.status === 'active'
    ? [{ value: 'suspended', label: 'Suspend access' }, { value: 'revoked', label: 'Remove from shop', danger: true }]
    : [{ value: 'active', label: 'Restore access' }, ...(member.status === 'suspended' ? [{ value: 'revoked', label: 'Remove from shop', danger: true }] : [])];
  return <RowMenu label={`Actions for ${member.user?.name || member.user?.email || 'member'}`} title={member.user?.name || member.user?.email || undefined} items={statusItems(member.status, options, (status) => setMemberStatusAction(member.id, status))} />;
}
