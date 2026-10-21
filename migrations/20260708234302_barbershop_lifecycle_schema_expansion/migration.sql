-- CreateEnum
CREATE TYPE "WaiverFormWaiverTypeType" AS ENUM ('chemical_service', 'minor_consent', 'photo_release', 'general');

-- CreateEnum
CREATE TYPE "WaiverFormStatusType" AS ENUM ('draft', 'sent', 'signed', 'expired');

-- CreateEnum
CREATE TYPE "GroomingNoteNoteTypeType" AS ENUM ('cut_formula', 'beard_detail', 'product_preference', 'allergy');

-- CreateEnum
CREATE TYPE "WaitlistEntryStatusType" AS ENUM ('waiting', 'notified', 'booked', 'expired');

-- CreateEnum
CREATE TYPE "NoShowPolicyStatusType" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "TipPaymentMethodType" AS ENUM ('card', 'cash', 'wallet');

-- CreateEnum
CREATE TYPE "CommissionStatusType" AS ENUM ('projected', 'approved', 'paid', 'voided');

-- CreateEnum
CREATE TYPE "SupplierStatusType" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "InventoryLotStatusType" AS ENUM ('active', 'consumed', 'expired');

-- CreateEnum
CREATE TYPE "ProductStatusType" AS ENUM ('active', 'draft', 'archived');

-- CreateEnum
CREATE TYPE "ProductProductTypeType" AS ENUM ('pomade', 'beard_care', 'shampoo', 'tool', 'other');

-- CreateEnum
CREATE TYPE "BarberChairStatusType" AS ENUM ('active', 'maintenance', 'reserved');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "_Barber_specialties" ADD CONSTRAINT "_Barber_specialties_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_Barber_specialties_AB_unique";

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "isInstalled" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createPaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "capturePaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "refundPaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "getPaymentStatusFunction" TEXT NOT NULL DEFAULT 'manual',
    "generatePaymentLinkFunction" TEXT NOT NULL DEFAULT 'manual',
    "handleWebhookFunction" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiverForm" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "appointment" TEXT,
    "waiverType" "WaiverFormWaiverTypeType" DEFAULT 'general',
    "status" "WaiverFormStatusType" DEFAULT 'draft',
    "signedByName" TEXT NOT NULL DEFAULT '',
    "signedAt" TIMESTAMP(3),
    "documentUrl" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaiverForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroomingNote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "barber" TEXT,
    "appointment" TEXT,
    "noteType" "GroomingNoteNoteTypeType" DEFAULT 'cut_formula',
    "body" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "privateToStaff" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroomingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "customer" TEXT,
    "requestedService" TEXT,
    "requestedBarber" TEXT,
    "status" "WaitlistEntryStatusType" DEFAULT 'waiting',
    "preferredAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoShowPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "status" "NoShowPolicyStatusType" DEFAULT 'active',
    "feeAmount" INTEGER DEFAULT 0,
    "graceMinutes" INTEGER DEFAULT 10,
    "appliesToMemberships" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoShowPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "tipNumber" TEXT NOT NULL DEFAULT '',
    "barber" TEXT,
    "customer" TEXT,
    "transaction" TEXT,
    "appointment" TEXT,
    "amount" INTEGER DEFAULT 0,
    "paymentMethod" "TipPaymentMethodType" DEFAULT 'card',
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "commissionNumber" TEXT NOT NULL DEFAULT '',
    "barber" TEXT,
    "transaction" TEXT,
    "appointment" TEXT,
    "status" "CommissionStatusType" DEFAULT 'projected',
    "serviceAmount" INTEGER DEFAULT 0,
    "productAmount" INTEGER DEFAULT 0,
    "commissionRate" DECIMAL(18,4) DEFAULT 0,
    "commissionAmount" INTEGER DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "status" "SupplierStatusType" DEFAULT 'active',
    "contactName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL DEFAULT '',
    "product" TEXT,
    "supplier" TEXT,
    "quantityReceived" INTEGER DEFAULT 0,
    "quantityRemaining" INTEGER DEFAULT 0,
    "unitCost" INTEGER DEFAULT 0,
    "receivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "InventoryLotStatusType" DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL DEFAULT '',
    "status" "ProductStatusType" DEFAULT 'active',
    "productType" "ProductProductTypeType" DEFAULT 'other',
    "price" INTEGER DEFAULT 0,
    "cost" INTEGER DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "inventoryTracked" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarberChair" (
    "id" TEXT NOT NULL,
    "chairNumber" TEXT NOT NULL DEFAULT '',
    "stationName" TEXT NOT NULL DEFAULT '',
    "status" "BarberChairStatusType" DEFAULT 'active',
    "assignedBarber" TEXT,
    "locationNote" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarberChair_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_code_key" ON "PaymentProvider"("code");

-- CreateIndex
CREATE INDEX "WaiverForm_customer_idx" ON "WaiverForm"("customer");

-- CreateIndex
CREATE INDEX "WaiverForm_appointment_idx" ON "WaiverForm"("appointment");

-- CreateIndex
CREATE INDEX "GroomingNote_customer_idx" ON "GroomingNote"("customer");

-- CreateIndex
CREATE INDEX "GroomingNote_barber_idx" ON "GroomingNote"("barber");

-- CreateIndex
CREATE INDEX "GroomingNote_appointment_idx" ON "GroomingNote"("appointment");

-- CreateIndex
CREATE INDEX "WaitlistEntry_customer_idx" ON "WaitlistEntry"("customer");

-- CreateIndex
CREATE INDEX "WaitlistEntry_requestedService_idx" ON "WaitlistEntry"("requestedService");

-- CreateIndex
CREATE INDEX "WaitlistEntry_requestedBarber_idx" ON "WaitlistEntry"("requestedBarber");

-- CreateIndex
CREATE UNIQUE INDEX "Tip_tipNumber_key" ON "Tip"("tipNumber");

-- CreateIndex
CREATE INDEX "Tip_barber_idx" ON "Tip"("barber");

-- CreateIndex
CREATE INDEX "Tip_customer_idx" ON "Tip"("customer");

-- CreateIndex
CREATE INDEX "Tip_transaction_idx" ON "Tip"("transaction");

-- CreateIndex
CREATE INDEX "Tip_appointment_idx" ON "Tip"("appointment");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_commissionNumber_key" ON "Commission"("commissionNumber");

-- CreateIndex
CREATE INDEX "Commission_barber_idx" ON "Commission"("barber");

-- CreateIndex
CREATE INDEX "Commission_transaction_idx" ON "Commission"("transaction");

-- CreateIndex
CREATE INDEX "Commission_appointment_idx" ON "Commission"("appointment");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_lotNumber_key" ON "InventoryLot"("lotNumber");

-- CreateIndex
CREATE INDEX "InventoryLot_product_idx" ON "InventoryLot"("product");

-- CreateIndex
CREATE INDEX "InventoryLot_supplier_idx" ON "InventoryLot"("supplier");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "BarberChair_chairNumber_key" ON "BarberChair"("chairNumber");

-- CreateIndex
CREATE INDEX "BarberChair_assignedBarber_idx" ON "BarberChair"("assignedBarber");

-- AddForeignKey
ALTER TABLE "WaiverForm" ADD CONSTRAINT "WaiverForm_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverForm" ADD CONSTRAINT "WaiverForm_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroomingNote" ADD CONSTRAINT "GroomingNote_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroomingNote" ADD CONSTRAINT "GroomingNote_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroomingNote" ADD CONSTRAINT "GroomingNote_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_requestedService_fkey" FOREIGN KEY ("requestedService") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_requestedBarber_fkey" FOREIGN KEY ("requestedBarber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_customer_fkey" FOREIGN KEY ("customer") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "CheckoutTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_barber_fkey" FOREIGN KEY ("barber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "CheckoutTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_supplier_fkey" FOREIGN KEY ("supplier") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberChair" ADD CONSTRAINT "BarberChair_assignedBarber_fkey" FOREIGN KEY ("assignedBarber") REFERENCES "Barber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

