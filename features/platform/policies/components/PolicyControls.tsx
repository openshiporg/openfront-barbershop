'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DrawerForm, Field, inputMoney, toDollars, TransitionPills } from '@/features/platform/lib/forms';
import { selectClass } from '@/features/platform/lib/ui';
import { publishBookingPolicyAction, retireBookingPolicyAction, saveNoShowPolicyAction, setNoShowPolicyStatusAction, type BookingPolicyRow, type NoShowPolicyRow } from '../actions/policies';

export function PublishPolicyButton({ current, jurisdictionCode }: { current?: BookingPolicyRow; jurisdictionCode: string }) {
  return (
    <DrawerForm trigger={current ? 'New version' : 'Publish policy'} triggerVariant="primary" title="Publish booking policy" description="Takes effect in a minute. Existing bookings keep the policy they were made under." action={publishBookingPolicyAction} submitLabel="Publish">
      <Field id="policy-name" label="Name" wide><Input id="policy-name" name="name" defaultValue={current?.name || 'Booking policy'} maxLength={120} /></Field>
      <Field id="policy-cancel" label="Free cancellation until (hours before)"><Input id="policy-cancel" name="cancellationHours" type="number" inputMode="decimal" min={0} max={720} step="0.5" defaultValue={(current?.cancellationWindowMinutes ?? 1440) / 60} className="font-mono" /></Field>
      <Field id="policy-late-fee" label="Late cancellation fee ($)"><Input id="policy-late-fee" name="lateCancellationFee" {...inputMoney} defaultValue={toDollars(current?.lateCancellationFeeAmount)} /></Field>
      <Field id="policy-resched" label="Free reschedule until (hours before)"><Input id="policy-resched" name="rescheduleHours" type="number" inputMode="decimal" min={0} max={720} step="0.5" defaultValue={(current?.rescheduleWindowMinutes ?? 1440) / 60} className="font-mono" /></Field>
      <Field id="policy-resched-fee" label="Late reschedule fee ($)"><Input id="policy-resched-fee" name="rescheduleFee" {...inputMoney} defaultValue={toDollars(current?.rescheduleFeeAmount)} /></Field>
      <Field id="policy-max" label="Customer reschedules allowed"><Input id="policy-max" name="maxCustomerReschedules" type="number" inputMode="numeric" min={0} max={20} defaultValue={current?.maxCustomerReschedules ?? 2} className="font-mono" /></Field>
      <Field id="policy-deposit" label="Deposit on late cancellation"><select id="policy-deposit" name="depositCancellationRule" defaultValue={current?.depositCancellationRule || 'manual_review'} className={selectClass}><option value="refund">Refund</option><option value="forfeit">Keep</option><option value="manual_review">Review by staff</option></select></Field>
      <Field id="policy-eligibility" label="Bookable online"><select id="policy-eligibility" name="publicServiceEligibility" defaultValue={current?.publicServiceEligibility || 'active_catalog'} className={selectClass}><option value="active_catalog">Services in an active category</option><option value="legacy_active_service">All active services</option></select></Field>
      <Field id="policy-jurisdiction" label="Jurisdiction"><Input id="policy-jurisdiction" name="jurisdictionCode" defaultValue={current?.jurisdictionCode || jurisdictionCode} maxLength={20} className="font-mono uppercase" /></Field>
    </DrawerForm>
  );
}

export function RetirePolicy({ policy }: { policy: BookingPolicyRow }) {
  if (policy.status !== 'active') return null;
  return <TransitionPills label="Policy status" current="active" options={[{ value: 'retired', label: 'Retire', danger: true }]} run={() => retireBookingPolicyAction(policy.id)} />;
}

function NoShowFields({ policy }: { policy?: NoShowPolicyRow }) {
  return <>
    <Field id="noshow-name" label="Name" wide><Input id="noshow-name" name="name" defaultValue={policy?.name} required maxLength={120} /></Field>
    <Field id="noshow-fee" label="Fee ($)"><Input id="noshow-fee" name="fee" {...inputMoney} defaultValue={toDollars(policy?.feeAmount)} /></Field>
    <Field id="noshow-grace" label="Grace period (min)"><Input id="noshow-grace" name="graceMinutes" type="number" inputMode="numeric" min={0} max={240} defaultValue={policy?.graceMinutes ?? 10} className="font-mono" /></Field>
    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="appliesToMemberships" defaultChecked={policy?.appliesToMemberships} className="size-4" />Applies to members</label>
    <Field id="noshow-description" label="Description" wide><Textarea id="noshow-description" name="description" defaultValue={policy?.description || ''} maxLength={1000} /></Field>
  </>;
}

export function NewNoShowPolicyButton() {
  return <DrawerForm trigger="New no-show policy" title="New no-show policy" action={(form) => saveNoShowPolicyAction(null, form)}><NoShowFields /></DrawerForm>;
}

export function NoShowPolicyActions({ policy }: { policy: NoShowPolicyRow }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <DrawerForm trigger="Edit" title={`Edit ${policy.name}`} action={(form) => saveNoShowPolicyAction(policy.id, form)}><NoShowFields policy={policy} /></DrawerForm>
      <TransitionPills label="Policy status" current={policy.status} options={[{ value: 'active', label: 'Use' }, { value: 'paused', label: 'Pause' }, { value: 'archived', label: 'Archive' }]} run={(status) => setNoShowPolicyStatusAction(policy.id, status)} />
    </span>
  );
}
