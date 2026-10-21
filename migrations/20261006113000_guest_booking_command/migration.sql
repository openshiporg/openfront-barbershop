-- Additive SOURCE DRAFT: must be compared with authoritative Keystone generation
-- and rehearsed on separately approved fresh/legacy PostgreSQL targets.
-- No legacy occurrence is adopted; no credential or accepted evidence backfill.
CREATE TABLE "GuestBookingCommand" (
  id TEXT NOT NULL,
  "requestKey" TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT '',
  "payloadHash" TEXT NOT NULL DEFAULT '',
  "proofHash" TEXT NOT NULL DEFAULT '',
  shop TEXT NOT NULL,
  appointment TEXT,
  receipt JSONB,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestBookingCommand_pkey" PRIMARY KEY (id)
);
CREATE UNIQUE INDEX "GuestBookingCommand_requestKey_key" ON "GuestBookingCommand"("requestKey");
CREATE INDEX "GuestBookingCommand_shop_idx" ON "GuestBookingCommand"(shop);
CREATE INDEX "GuestBookingCommand_appointment_idx" ON "GuestBookingCommand"(appointment);
ALTER TABLE "GuestBookingCommand" ADD CONSTRAINT "GuestBookingCommand_shop_fkey" FOREIGN KEY (shop) REFERENCES "Shop"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuestBookingCommand" ADD CONSTRAINT "GuestBookingCommand_appointment_fkey" FOREIGN KEY (appointment) REFERENCES "Appointment"(id) ON DELETE SET NULL ON UPDATE CASCADE;
