'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Pill } from '@/features/platform/lib/ui';
import { RowMenu } from '@/features/platform/records/lib/controls';
import { BarberAccountLink } from '../screens/BarberAccountLink';
import { WorkforceControls, zoneLabel } from '../screens/WorkforceControls';

type Shift = { id: string; status: string; scheduledStart: string; scheduledEnd: string; clockedInAt?: string | null };
type Exception = { id: string; exceptionType: string; startsAt: string; endsAt: string; reason: string };
type Member = { id: string; name: string; email: string | null };

/** Shifts, time off, hours overrides and chair blocks for one barber, in a drawer named for that barber. */
export function BarberScheduleDrawer({ barber, timeZone, members }: {
  barber: { id: string; displayName: string; chairId?: string; chairLabel?: string; shifts: Shift[]; exceptions: Exception[]; linkedUserId: string | null };
  timeZone: string | null;
  members?: Member[] | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <Pill size="sm" onClick={() => setOpen(true)} aria-label={`Schedule ${barber.displayName}`}>Schedule</Pill>
      <RowMenu label={`More for ${barber.displayName}`} title={barber.displayName} items={[
        { label: 'Profile', href: `/dashboard/platform/staff/${barber.id}` },
        { label: 'Weekly hours', href: `/dashboard/platform/staff/${barber.id}#barber-hours` },
        { label: 'Credentials', href: `/dashboard/platform/staff/${barber.id}#barber-credentials` },
      ]} />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{barber.displayName}</SheetTitle>
            <SheetDescription>{[barber.chairLabel || 'No chair', timeZone ? `Times in ${zoneLabel(timeZone)}` : null].filter(Boolean).join(' · ')}</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-8">
            <WorkforceControls bare timeZone={timeZone} barberId={barber.id} chairId={barber.chairId} chairLabel={barber.chairLabel} shifts={barber.shifts} exceptions={barber.exceptions} />
            {members ? <div className="border-t pt-4"><BarberAccountLink barberId={barber.id} linkedUserId={barber.linkedUserId} members={members} /></div> : null}
          </div>
        </SheetContent>
      </Sheet>
    </span>
  );
}

/** Shop-wide closure, kept behind a button. */
export function ShopClosureDrawer({ timeZone, exceptions }: { timeZone: string | null; exceptions: Exception[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pill onClick={() => setOpen(true)}>Close shop</Pill>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Close the shop</SheetTitle>
            <SheetDescription>{['Every barber and chair', timeZone ? `times in ${zoneLabel(timeZone)}` : null].filter(Boolean).join(' · ')}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8">
            <WorkforceControls bare timeZone={timeZone} shifts={[]} exceptions={exceptions} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
