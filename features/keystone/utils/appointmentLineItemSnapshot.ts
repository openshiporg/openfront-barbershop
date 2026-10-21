export type AppointmentServiceSnapshotSource = {
  id?: string | null;
  name?: string | null;
  price?: number | null;
  durationMinutes?: number | null;
  imagePath?: string | null;
};

export type AppointmentBarberSnapshotSource = {
  id?: string | null;
  displayName?: string | null;
  chairNumber?: string | null;
};

export type AppointmentPackageSnapshotSource = {
  id?: string | null;
  remainingVisits?: number | null;
  servicePackage?: { id?: string | null; name?: string | null } | null;
  membershipPlan?: { id?: string | null; name?: string | null } | null;
};

export type AppointmentSnapshotSource = {
  price?: number | null;
  durationMinutes?: number | null;
  service?: AppointmentServiceSnapshotSource | null;
  barber?: AppointmentBarberSnapshotSource | null;
};

export type AppointmentLineItemSnapshot = {
  title: string;
  price: number;
  durationMinutes: number;
  imagePath: string;
  modifiers: Record<string, unknown>[];
  barberName: string;
  barberChairNumber: string;
  packageBalanceId: string;
  packageName: string;
  packageVisitsConsumed: number;
};

function nonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

export function buildAppointmentLineItemSnapshot(
  appointment: AppointmentSnapshotSource,
  packageBalance?: AppointmentPackageSnapshotSource | null
): AppointmentLineItemSnapshot {
  const service = appointment.service;
  const barber = appointment.barber;

  return {
    title: service?.name?.trim() || 'Barbershop service',
    price: nonNegativeInteger(appointment.price ?? service?.price),
    durationMinutes: nonNegativeInteger(
      appointment.durationMinutes ?? service?.durationMinutes,
      30
    ),
    imagePath: service?.imagePath?.trim() || '',
    modifiers: [],
    barberName: barber?.displayName?.trim() || '',
    barberChairNumber: barber?.chairNumber?.trim() || '',
    packageBalanceId: packageBalance?.id?.trim() || '',
    packageName:
      packageBalance?.servicePackage?.name?.trim() ||
      packageBalance?.membershipPlan?.name?.trim() ||
      '',
    packageVisitsConsumed: packageBalance?.id ? 1 : 0,
  };
}
