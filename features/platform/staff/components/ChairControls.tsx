'use client';

import { Input } from '@/components/ui/input';
import { DrawerForm, Field, TransitionPills } from '@/features/platform/lib/forms';
import { saveChairAction, setChairStatusAction, type ChairRow } from '../actions/chairs';

function ChairFields({ chair }: { chair?: ChairRow }) {
  return <>
    <Field id="chair-number" label="Chair number"><Input id="chair-number" name="chairNumber" defaultValue={chair?.chairNumber} required maxLength={20} className="font-mono" /></Field>
    <Field id="chair-station" label="Station name"><Input id="chair-station" name="stationName" defaultValue={chair?.stationName || ''} maxLength={120} /></Field>
    <Field id="chair-note" label="Location" wide><Input id="chair-note" name="locationNote" defaultValue={chair?.locationNote || ''} maxLength={500} /></Field>
  </>;
}

export function NewChairButton() {
  return <DrawerForm trigger="New chair" triggerVariant="primary" title="New chair" action={(form) => saveChairAction(null, form)}><ChairFields /></DrawerForm>;
}

export function ChairActions({ chair }: { chair: ChairRow }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <DrawerForm trigger="Edit" title={`Edit chair ${chair.chairNumber}`} action={(form) => saveChairAction(chair.id, form)}><ChairFields chair={chair} /></DrawerForm>
      <TransitionPills label="Chair status" current={chair.status} options={[{ value: 'active', label: 'In service' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'reserved', label: 'Reserved' }]} run={(status) => setChairStatusAction(chair.id, status)} />
    </span>
  );
}
