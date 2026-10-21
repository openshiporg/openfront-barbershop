-- Additive Batch 2 hardening. No rows or business evidence are deleted.
-- Retained receipts can be labeled USD only when their shop confirms that scope.
-- Fail atomically on ambiguous schedules/currency rather than guessing or merging.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "CheckoutTransaction" t JOIN "Shop" s ON s.id = t.shop WHERE upper(s."currencyCode") <> 'USD') THEN
    RAISE EXCEPTION 'Non-USD receipt history requires an owner-reviewed currency backfill before this release';
  END IF;
  IF EXISTS (SELECT 1 FROM "BarberSchedule" GROUP BY barber, "dayOfWeek" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate recurring schedules require owner review; no rows were changed';
  END IF;
END $$;
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "guestNameSnapshot" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "CheckoutTransaction" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "merchantSnapshot" JSONB,
ADD COLUMN     "taxRuleSnapshot" JSONB;

-- Pinned Prisma 6.5 expects the implicit relation's unique index. Establish
-- equivalent uniqueness BEFORE replacing the prior engine's primary key.
CREATE UNIQUE INDEX "_Barber_specialties_AB_unique" ON "_Barber_specialties"("A", "B");
ALTER TABLE "_Barber_specialties" DROP CONSTRAINT "_Barber_specialties_AB_pkey";

-- CreateTable
CREATE TABLE "CashRefund" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "transaction" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER,
    "tipAmount" INTEGER DEFAULT 0,
    "taxAmount" INTEGER DEFAULT 0,
    "refundedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashRefund_transaction_key" ON "CashRefund"("transaction");

-- CreateIndex
CREATE UNIQUE INDEX "CashRefund_eventKey_key" ON "CashRefund"("eventKey");

-- CreateIndex
CREATE INDEX "CashRefund_shop_idx" ON "CashRefund"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "BarberSchedule_barber_dayOfWeek_key" ON "BarberSchedule"("barber", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "CashRefund" ADD CONSTRAINT "CashRefund_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRefund" ADD CONSTRAINT "CashRefund_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "CheckoutTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
