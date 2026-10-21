-- CreateEnum
CREATE TYPE "InventoryMovementMovementTypeType" AS ENUM ('receive', 'sale', 'return', 'waste', 'adjustment');

-- CreateEnum
CREATE TYPE "PackageUsageUsageTypeType" AS ENUM ('grant', 'consume', 'restore', 'expire', 'adjustment');

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "replayKey" TEXT NOT NULL DEFAULT '',
    "providerCode" TEXT NOT NULL DEFAULT '',
    "providerEventId" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "processedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "product" TEXT,
    "inventoryLot" TEXT,
    "movementType" "InventoryMovementMovementTypeType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "referenceKey" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageUsage" (
    "id" TEXT NOT NULL,
    "customerPackage" TEXT,
    "appointment" TEXT,
    "transaction" TEXT,
    "usageType" "PackageUsageUsageTypeType" NOT NULL,
    "visitsDelta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "referenceKey" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_replayKey_key" ON "PaymentWebhookEvent"("replayKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_referenceKey_key" ON "InventoryMovement"("referenceKey");

-- CreateIndex
CREATE INDEX "InventoryMovement_product_idx" ON "InventoryMovement"("product");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryLot_idx" ON "InventoryMovement"("inventoryLot");

-- CreateIndex
CREATE UNIQUE INDEX "PackageUsage_referenceKey_key" ON "PackageUsage"("referenceKey");

-- CreateIndex
CREATE INDEX "PackageUsage_customerPackage_idx" ON "PackageUsage"("customerPackage");

-- CreateIndex
CREATE INDEX "PackageUsage_appointment_idx" ON "PackageUsage"("appointment");

-- CreateIndex
CREATE INDEX "PackageUsage_transaction_idx" ON "PackageUsage"("transaction");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryLot_fkey" FOREIGN KEY ("inventoryLot") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageUsage" ADD CONSTRAINT "PackageUsage_customerPackage_fkey" FOREIGN KEY ("customerPackage") REFERENCES "CustomerPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageUsage" ADD CONSTRAINT "PackageUsage_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageUsage" ADD CONSTRAINT "PackageUsage_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "CheckoutTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
