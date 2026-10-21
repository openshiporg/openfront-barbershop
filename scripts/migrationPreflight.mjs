import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Read-only compatibility guard. Historical applied migration checksums are never
// rewritten. Ambiguous legacy upgrades stop before Prisma touches maintained data.
const prisma = new PrismaClient();
try {
  const [tables] = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."_prisma_migrations"')::text AS history, to_regclass('public."WaiverForm"')::text AS waivers, to_regclass('public."Appointment"')::text AS appointments`);
  if (!tables.history && (tables.waivers || tables.appointments)) throw new Error('Existing unbaselined business tables require owner-reviewed migration history.');
  const history = tables.history ? await prisma.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL') : [];
  const applied = new Set(history.map((row) => row.migration_name));
  if (tables.waivers && !applied.has('20260806084906_barbershop_domain_core_20260806')) {
    const [row] = await prisma.$queryRawUnsafe('SELECT count(*)::int AS count FROM "WaiverForm"');
    if (row.count > 1) throw new Error('Legacy waiver upgrade needs a reviewed signature-key backfill. Historical migration would collide on empty keys. No migration was run; do not reset or delete waivers.');
  }
  if (tables.appointments && !applied.has('20260718190000_barbershop_required_shop_tenancy_and_lifecycle_outbox')) {
    const [row] = await prisma.$queryRawUnsafe('SELECT count(*)::int AS count FROM "Appointment"');
    if (row.count > 0) throw new Error('Legacy appointment ownership must be reviewed before the historical demo-specific tenancy backfill. No migration was run.');
  }
  console.log('Migration compatibility preflight passed (read-only).');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Migration compatibility preflight failed.');
  process.exitCode = 1;
} finally { await prisma.$disconnect(); }
