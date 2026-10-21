-- Required tenant ownership and lifecycle evidence foundation.
-- Existing data predates multi-shop operation and is intentionally attached to the
-- one canonical Stack & Fade shop before constraints are made required.

CREATE TEMP TABLE "_TenantBackfillShop" AS
SELECT "id"
FROM "Shop"
WHERE "slug" = 'stack-and-fade'
  AND "status" = 'active'
ORDER BY "createdAt" ASC
LIMIT 1;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "_TenantBackfillShop") <> 1
     AND (
       (SELECT COUNT(*) FROM "Appointment")
       + (SELECT COUNT(*) FROM "Barber")
       + (SELECT COUNT(*) FROM "Customer")
       + (SELECT COUNT(*) FROM "Service")
       + (SELECT COUNT(*) FROM "Product")
       + (SELECT COUNT(*) FROM "ShopMembership")
     ) > 0 THEN
    RAISE EXCEPTION 'Existing merchant data requires the canonical active shop stack-and-fade';
  END IF;
END $$;

CREATE TYPE "LifecycleOutboxEventStatusType" AS ENUM ('pending', 'processing', 'delivered', 'dead_letter');

ALTER TABLE "BarberChair" DROP CONSTRAINT "BarberChair_assignedBarber_fkey";
ALTER TABLE "ShopMembership" DROP CONSTRAINT "ShopMembership_shop_fkey";
DROP INDEX "BarberChair_assignedBarber_idx";
DROP INDEX "PaymentProvider_code_key";

ALTER TABLE "Appointment" ADD COLUMN "chair" TEXT, ADD COLUMN "shop" TEXT;
ALTER TABLE "Barber" ADD COLUMN "chair" TEXT, ADD COLUMN "shop" TEXT;
ALTER TABLE "BarberChair" ADD COLUMN "shop" TEXT;
ALTER TABLE "CheckoutTransaction" ADD COLUMN "shop" TEXT;
ALTER TABLE "Commission" ADD COLUMN "shop" TEXT;
ALTER TABLE "Customer" ADD COLUMN "shop" TEXT;
ALTER TABLE "CustomerPackage" ADD COLUMN "shop" TEXT;
ALTER TABLE "InventoryLot" ADD COLUMN "shop" TEXT;
ALTER TABLE "InventoryMovement" ADD COLUMN "shop" TEXT;
ALTER TABLE "MembershipPlan" ADD COLUMN "shop" TEXT;
ALTER TABLE "PaymentProvider" ADD COLUMN "shop" TEXT;
ALTER TABLE "PaymentSession" ADD COLUMN "shop" TEXT;
ALTER TABLE "Product" ADD COLUMN "shop" TEXT;
ALTER TABLE "Service" ADD COLUMN "shop" TEXT;
ALTER TABLE "ServiceCategory" ADD COLUMN "shop" TEXT;
ALTER TABLE "ServicePackage" ADD COLUMN "shop" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "shop" TEXT;
ALTER TABLE "Tip" ADD COLUMN "shop" TEXT;
ALTER TABLE "WalkInQueueEntry" ADD COLUMN "shop" TEXT;

-- Preserve any legacy explicit chair assignment before changing relation ownership.
UPDATE "Barber" AS barber
SET "chair" = chair."id"
FROM "BarberChair" AS chair
WHERE chair."assignedBarber" = barber."id";

-- Materialize chairs for seeded barbers that previously had only a chair-number string.
INSERT INTO "BarberChair" (
  "id", "chairNumber", "stationName", "status", "shop", "createdAt", "updatedAt"
)
SELECT
  'tenant-chair-' || md5(backfill."id" || ':' || barber."chairNumber"),
  barber."chairNumber",
  'Chair ' || barber."chairNumber",
  'active'::"BarberChairStatusType",
  backfill."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "chairNumber"
  FROM "Barber"
  WHERE COALESCE("chairNumber", '') <> ''
) AS barber
CROSS JOIN "_TenantBackfillShop" AS backfill
WHERE NOT EXISTS (
  SELECT 1 FROM "BarberChair" AS existing
  WHERE existing."chairNumber" = barber."chairNumber"
);

UPDATE "Barber" AS barber
SET "chair" = chair."id"
FROM "BarberChair" AS chair
WHERE barber."chair" IS NULL
  AND COALESCE(barber."chairNumber", '') <> ''
  AND chair."chairNumber" = barber."chairNumber";

UPDATE "Appointment" AS appointment
SET "chair" = barber."chair"
FROM "Barber" AS barber
WHERE appointment."barber" = barber."id"
  AND barber."chair" IS NOT NULL;

ALTER TABLE "BarberChair" DROP COLUMN "assignedBarber";

UPDATE "ShopMembership" SET "shop" = backfill."id"
FROM "_TenantBackfillShop" AS backfill WHERE "ShopMembership"."shop" IS NULL;
UPDATE "ServiceCategory" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "Service" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "Barber" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "BarberChair" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "Customer" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "Appointment" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "WalkInQueueEntry" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "MembershipPlan" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "ServicePackage" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "CustomerPackage" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "CheckoutTransaction" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "PaymentProvider" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "PaymentSession" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "InventoryMovement" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "Tip" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "Commission" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "Supplier" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "InventoryLot" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;
UPDATE "Product" SET "shop" = backfill."id" FROM "_TenantBackfillShop" AS backfill;

ALTER TABLE "ShopMembership" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "ServiceCategory" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "Barber" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "BarberChair" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "WalkInQueueEntry" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "MembershipPlan" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "ServicePackage" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "CustomerPackage" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "CheckoutTransaction" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "PaymentProvider" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "PaymentSession" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "InventoryMovement" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "Tip" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "Commission" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "Supplier" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "InventoryLot" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "shop" SET NOT NULL;

ALTER TABLE "_Barber_specialties" ADD CONSTRAINT "_Barber_specialties_AB_pkey" PRIMARY KEY ("A", "B");
DROP INDEX "_Barber_specialties_AB_unique";

CREATE TABLE "LifecycleOutboxEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "shop" TEXT NOT NULL,
    "payload" JSONB,
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "status" "LifecycleOutboxEventStatusType" DEFAULT 'pending',
    "attempts" INTEGER DEFAULT 0,
    "maxAttempts" INTEGER DEFAULT 8,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "replayCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LifecycleOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LifecycleOutboxEvent_eventKey_key" ON "LifecycleOutboxEvent"("eventKey");
CREATE INDEX "LifecycleOutboxEvent_shop_idx" ON "LifecycleOutboxEvent"("shop");
CREATE INDEX "Appointment_shop_idx" ON "Appointment"("shop");
CREATE INDEX "Appointment_chair_idx" ON "Appointment"("chair");
CREATE INDEX "Barber_chair_idx" ON "Barber"("chair");
CREATE INDEX "Barber_shop_idx" ON "Barber"("shop");
CREATE INDEX "BarberChair_shop_idx" ON "BarberChair"("shop");
CREATE INDEX "CheckoutTransaction_shop_idx" ON "CheckoutTransaction"("shop");
CREATE INDEX "Commission_shop_idx" ON "Commission"("shop");
CREATE INDEX "Customer_shop_idx" ON "Customer"("shop");
CREATE INDEX "CustomerPackage_shop_idx" ON "CustomerPackage"("shop");
CREATE INDEX "InventoryLot_shop_idx" ON "InventoryLot"("shop");
CREATE INDEX "InventoryMovement_shop_idx" ON "InventoryMovement"("shop");
CREATE INDEX "MembershipPlan_shop_idx" ON "MembershipPlan"("shop");
CREATE INDEX "PaymentProvider_shop_idx" ON "PaymentProvider"("shop");
CREATE INDEX "PaymentProvider_code_idx" ON "PaymentProvider"("code");
CREATE INDEX "PaymentSession_shop_idx" ON "PaymentSession"("shop");
CREATE INDEX "Product_shop_idx" ON "Product"("shop");
CREATE INDEX "Service_shop_idx" ON "Service"("shop");
CREATE INDEX "ServiceCategory_shop_idx" ON "ServiceCategory"("shop");
CREATE INDEX "ServicePackage_shop_idx" ON "ServicePackage"("shop");
CREATE INDEX "Supplier_shop_idx" ON "Supplier"("shop");
CREATE INDEX "Tip_shop_idx" ON "Tip"("shop");
CREATE INDEX "WalkInQueueEntry_shop_idx" ON "WalkInQueueEntry"("shop");

ALTER TABLE "ShopMembership" ADD CONSTRAINT "ShopMembership_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LifecycleOutboxEvent" ADD CONSTRAINT "LifecycleOutboxEvent_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Barber" ADD CONSTRAINT "Barber_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Barber" ADD CONSTRAINT "Barber_chair_fkey" FOREIGN KEY ("chair") REFERENCES "BarberChair"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_chair_fkey" FOREIGN KEY ("chair") REFERENCES "BarberChair"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalkInQueueEntry" ADD CONSTRAINT "WalkInQueueEntry_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckoutTransaction" ADD CONSTRAINT "CheckoutTransaction_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentProvider" ADD CONSTRAINT "PaymentProvider_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BarberChair" ADD CONSTRAINT "BarberChair_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "_TenantBackfillShop";
