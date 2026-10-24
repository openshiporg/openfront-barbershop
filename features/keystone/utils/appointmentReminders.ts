import type { PrismaClient } from '@prisma/client';

import { formatShopDateTime } from '../../shared/shop-time';
import { sendAppointmentEmail } from '../lib/mail';

// Reminders go out roughly a day ahead. There is no scheduler, so the sweep runs
// on ordinary traffic (storefront and booking board), at most once every few
// minutes per server, and each visit is claimed once through reminderSentAt.
const WINDOW_START_MS = 20 * 3600_000;
const WINDOW_END_MS = 28 * 3600_000;
const MIN_INTERVAL_MS = 5 * 60_000;
let lastSweep = 0;

export function triggerReminderSweep(prisma: PrismaClient) {
  const now = Date.now();
  if (now - lastSweep < MIN_INTERVAL_MS) return;
  lastSweep = now;
  void sendDueReminders(prisma, new Date(now)).catch(() => undefined);
}

export async function sendDueReminders(prisma: PrismaClient, now = new Date()) {
  const due = await prisma.appointment.findMany({
    where: {
      status: { in: ['requested', 'confirmed'] },
      reminderSentAt: null,
      startsAt: { gte: new Date(now.getTime() + WINDOW_START_MS), lt: new Date(now.getTime() + WINDOW_END_MS) },
      customer: { email: { not: '' } },
    },
    take: 25,
    select: { id: true, startsAt: true, serviceTitleSnapshot: true, barberNameSnapshot: true, customer: { select: { email: true } }, shop: { select: { name: true, timezone: true, address: true } } },
  });
  let sent = 0;
  for (const visit of due) {
    const to = visit.customer?.email?.trim();
    if (!to) continue;
    const claimed = await prisma.appointment.updateMany({ where: { id: visit.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!claimed.count) continue;
    try {
      await sendAppointmentEmail({
        to,
        subject: `Reminder: your visit tomorrow · ${visit.shop.name}`,
        heading: 'See you tomorrow',
        lines: [
          `${visit.serviceTitleSnapshot || 'Appointment'} with ${visit.barberNameSnapshot || 'your barber'}`,
          formatShopDateTime(visit.startsAt, visit.shop.timezone || 'UTC'),
          ...(visit.shop.address ? [visit.shop.address] : []),
        ],
        path: `/appointment?id=${encodeURIComponent(visit.id)}`,
        action: 'View or change booking',
      });
      sent += 1;
    } catch {
      // Mail unavailable: release the claim so a later sweep can retry.
      await prisma.appointment.updateMany({ where: { id: visit.id, reminderSentAt: now }, data: { reminderSentAt: null } }).catch(() => undefined);
    }
  }
  return sent;
}
