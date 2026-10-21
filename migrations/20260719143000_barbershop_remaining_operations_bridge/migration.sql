-- CreateEnum
CREATE TYPE "CommissionPayoutStatusType" AS ENUM ('paid', 'voided');

-- CreateEnum
CREATE TYPE "ProductSaleLineLineTypeType" AS ENUM ('sale', 'return');

-- AlterTable
ALTER TABLE "Commission" ADD COLUMN     "payout" TEXT;

-- AlterTable
ALTER TABLE "CustomerNote" ADD COLUMN     "shop" TEXT;

-- AlterTable
ALTER TABLE "GroomingNote" ADD COLUMN     "shop" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "productSaleLine" TEXT;

-- AlterTable
ALTER TABLE "NoShowPolicy" ADD COLUMN     "shop" TEXT;

-- AlterTable
ALTER TABLE "WaiverForm" ADD COLUMN     "shop" TEXT;

-- Backfill ancillary records through their tenant-owned parent where possible,
-- then use the canonical shop for legacy orphaned policy/demo rows.
UPDATE "CustomerNote" AS note SET "shop" = customer."shop" FROM "Customer" AS customer WHERE note."customer" = customer."id";
UPDATE "GroomingNote" AS note SET "shop" = customer."shop" FROM "Customer" AS customer WHERE note."customer" = customer."id";
UPDATE "WaiverForm" AS waiver SET "shop" = customer."shop" FROM "Customer" AS customer WHERE waiver."customer" = customer."id";
UPDATE "NoShowPolicy" SET "shop" = shop."id" FROM "Shop" AS shop WHERE shop."slug" = 'stack-and-fade' AND "NoShowPolicy"."shop" IS NULL;
UPDATE "CustomerNote" SET "shop" = shop."id" FROM "Shop" AS shop WHERE shop."slug" = 'stack-and-fade' AND "CustomerNote"."shop" IS NULL;
UPDATE "GroomingNote" SET "shop" = shop."id" FROM "Shop" AS shop WHERE shop."slug" = 'stack-and-fade' AND "GroomingNote"."shop" IS NULL;
UPDATE "WaiverForm" SET "shop" = shop."id" FROM "Shop" AS shop WHERE shop."slug" = 'stack-and-fade' AND "WaiverForm"."shop" IS NULL;
ALTER TABLE "CustomerNote" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "GroomingNote" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "NoShowPolicy" ALTER COLUMN "shop" SET NOT NULL;
ALTER TABLE "WaiverForm" ALTER COLUMN "shop" SET NOT NULL;

-- CreateTable
CREATE TABLE "NoShowEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "appointment" TEXT,
    "customer" TEXT,
    "policy" TEXT,
    "policyNameSnapshot" TEXT NOT NULL DEFAULT '',
    "feeAmount" INTEGER NOT NULL,
    "graceMinutes" INTEGER NOT NULL,
    "feeWaived" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL DEFAULT '',
    "markedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoShowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPayout" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL DEFAULT '',
    "idempotencyKeyHash" TEXT NOT NULL DEFAULT '',
    "barber" TEXT,
    "status" "CommissionPayoutStatusType" DEFAULT 'paid',
    "commissionCount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSaleLine" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "lineNumber" TEXT NOT NULL DEFAULT '',
    "transaction" TEXT,
    "product" TEXT,
    "originalLine" TEXT,
    "lineType" "ProductSaleLineLineTypeType" DEFAULT 'sale',
    "productNameSnapshot" TEXT NOT NULL DEFAULT '',
    "skuSnapshot" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "returnedQuantity" INTEGER DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReconciliation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "paymentSession" TEXT,
    "localStatusBefore" TEXT NOT NULL DEFAULT '',
    "remoteStatus" TEXT NOT NULL DEFAULT '',
    "localStatusAfter" TEXT NOT NULL DEFAULT '',
    "changed" BOOLEAN NOT NULL DEFAULT false,
    "amount" INTEGER NOT NULL,
    "providerPayloadHash" TEXT NOT NULL DEFAULT '',
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoShowEvent_eventKey_key" ON "NoShowEvent"("eventKey");

-- CreateIndex
CREATE INDEX "NoShowEvent_shop_idx" ON "NoShowEvent"("shop");

-- CreateIndex
CREATE INDEX "NoShowEvent_appointment_idx" ON "NoShowEvent"("appointment");

-- CreateIndex
CREATE INDEX "NoShowEvent_customer_idx" ON "NoShowEvent"("customer");

-- CreateIndex
CREATE INDEX "NoShowEvent_policy_idx" ON "NoShowEvent"("policy");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayout_payoutNumber_key" ON "CommissionPayout"("payoutNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPayout_idempotencyKeyHash_key" ON "CommissionPayout"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "CommissionPayout_shop_idx" ON "CommissionPayout"("shop");

-- CreateIndex
CREATE INDEX "CommissionPayout_barber_idx" ON "CommissionPayout"("barber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSaleLine_lineNumber_key" ON "ProductSaleLine"("lineNumber");

-- CreateIndex
CREATE INDEX "ProductSaleLine_shop_idx" ON "ProductSaleLine"("shop");

-- CreateIndex
CREATE INDEX "ProductSaleLine_transaction_idx" ON "ProductSaleLine"("transaction");

-- CreateIndex
CREATE INDEX "ProductSaleLine_product_idx" ON "ProductSaleLine"("product");

-- CreateIndex
CREATE INDEX "ProductSaleLine_originalLine_idx" ON "ProductSaleLine"("originalLine");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReconciliation_eventKey_key" ON "PaymentReconciliation"("eventKey");

-- CreateIndex
CREATE INDEX "PaymentReconciliation_shop_idx" ON "PaymentReconciliation"("shop");

-- CreateIndex
CREATE INDEX "PaymentReconciliation_paymentSession_idx" ON "PaymentReconciliation"("paymentSession");

-- CreateIndex
CREATE INDEX "Commission_payout_idx" ON "Commission"("payout");

-- CreateIndex
CREATE INDEX "CustomerNote_shop_idx" ON "CustomerNote"("shop");

-- CreateIndex
CREATE INDEX "GroomingNote_shop_idx" ON "GroomingNote"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_productSaleLine_key" ON "InventoryMovement"("productSaleLine");

-- CreateIndex
CREATE INDEX "NoShowPolicy_shop_idx" ON "NoShowPolicy"("shop");

-- CreateIndex
CREATE INDEX "WaiverForm_shop_idx" ON "WaiverForm"("shop");

-- AddForeignKey
ALTER TABLE "NoShowEvent" ADD CONSTRAINT "NoShowEvent_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoShowEvent" ADD CONSTRAINT "NoShowEvent_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoShowEvent" ADD CONSTRAINT "NoShowEvent_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoShowEvent" ADD CONSTRAINT "NoShowEvent_policy_fkey" FOREIGN KEY ("policy") REFERENCES "NoShowPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSaleLine" ADD CONSTRAINT "ProductSaleLine_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSaleLine" ADD CONSTRAINT "ProductSaleLine_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "CheckoutTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSaleLine" ADD CONSTRAINT "ProductSaleLine_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSaleLine" ADD CONSTRAINT "ProductSaleLine_originalLine_fkey" FOREIGN KEY ("originalLine") REFERENCES "ProductSaleLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_paymentSession_fkey" FOREIGN KEY ("paymentSession") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productSaleLine_fkey" FOREIGN KEY ("productSaleLine") REFERENCES "ProductSaleLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverForm" ADD CONSTRAINT "WaiverForm_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroomingNote" ADD CONSTRAINT "GroomingNote_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoShowPolicy" ADD CONSTRAINT "NoShowPolicy_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_payout_fkey" FOREIGN KEY ("payout") REFERENCES "CommissionPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

