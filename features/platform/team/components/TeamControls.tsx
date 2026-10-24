'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { DrawerForm, Field, TransitionPills } from '@/features/platform/lib/forms';
import { selectClass } from '@/features/platform/lib/ui';
import { addMemberAction, setMemberRoleAction, setMemberStatusAction, type TeamMember } from '../actions/team';

import { ROLE_LABELS } from '../lib/roles';

function RoleSelect({ id, name, defaultValue, onChange, disabled }: { id: string; name?: string; defaultValue: string; onChange?: (value: string) => void; disabled?: boolean }) {
  return (
    <select id={id} name={name} defaultValue={defaultValue} disabled={disabled} onChange={(event) => onChange?.(event.target.value)} className={`${selectClass} w-36`}>
      {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  );
}

export function AddMemberButton() {
  return (
    <DrawerForm trigger="Add member" triggerVariant="primary" title="Add a team member" description="Someone without an account gets an email to set a password." action={addMemberAction} submitLabel="Add">
      <Field id="member-email" label="Account email" wide><Input id="member-email" name="email" type="email" required maxLength={254} autoComplete="off" /></Field>
      <Field id="member-role" label="Role"><RoleSelect id="member-role" name="membershipRole" defaultValue="barber" /></Field>
    </DrawerForm>
  );
}

export function MemberActions({ member, self }: { member: TeamMember; self: boolean }) {
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
  const options = member.status === 'active'
    ? [{ value: 'suspended', label: 'Suspend' }, { value: 'revoked', label: 'Remove', danger: true }]
    : [{ value: 'active', label: 'Restore' }, ...(member.status === 'suspended' ? [{ value: 'revoked', label: 'Remove', danger: true }] : [])];
  return (
    <span className="flex flex-wrap items-center gap-2">
      <RoleSelect id={`role-${member.id}`} defaultValue={member.membershipRole} onChange={changeRole} disabled={pending || member.status === 'revoked'} />
      {!self ? <TransitionPills label="Membership status" current={member.status} options={options} run={(status) => setMemberStatusAction(member.id, status)} /> : null}
      {error ? <span role="alert" className="w-full text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
