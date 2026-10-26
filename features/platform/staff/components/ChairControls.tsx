'use client';

import { Input } from '@/components/ui/input';
import { DrawerForm, Field } from '@/features/platform/lib/forms';
import { RowMenu, statusItems } from '@/features/platform/records/lib/controls';
import { saveChairAction, setChairStatusAction, type ChairRow } from '../actions/chairs';

function ChairFields({ chair }: { chair?: ChairRow }) {
  return <>
    <Field id="chair-number" label="Chair number"><Input id="chair-number" name="chairNumber" defaultValue={chair?.chairNumber} required maxLength={20} className="h-9 rounded-[6px] font-mono" /></Field>
    <Field id="chair-station" label="Station name"><Input id="chair-station" name="stationName" defaultValue={chair?.stationName || ''} maxLength={120} className="h-9 rounded-[6px]" /></Field>
    <Field id="chair-note" label="Location" wide><Input id="chair-note" name="locationNote" defaultValue={chair?.locationNote || ''} maxLength={500} className="h-9 rounded-[6px]" /></Field>
  </>;
}

export function NewChairButton() {
  return <DrawerForm trigger="New chair" triggerVariant="primary" title="New chair" action={(form) => saveChairAction(null, form)}><ChairFields /></DrawerForm>;
}

export function ChairActions({ chair }: { chair: ChairRow }) {
  return (
    <span className="inline-flex items-center gap-1">
      <DrawerForm trigger="Edit" title={`Edit chair ${chair.chairNumber}`} action={(form) => saveChairAction(chair.id, form)}><ChairFields chair={chair} /></DrawerForm>
      <RowMenu label={`Status for chair ${chair.chairNumber}`} title={`Chair ${chair.chairNumber}`} items={statusItems(chair.status, [{ value: 'active', label: 'Put in service' }, { value: 'maintenance', label: 'Mark maintenance' }, { value: 'reserved', label: 'Reserve' }], (status) => setChairStatusAction(chair.id, status))} />
    </span>
  );
}
