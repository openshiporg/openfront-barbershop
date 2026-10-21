/*
  Warnings:

  - A unique constraint covering the columns `[paymentSession]` on the table `CheckoutTransaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PaymentSessionStatusType" AS ENUM ('pending', 'authorized', 'captured', 'failed', 'expired', 'cancelled', 'partially_refunded', 'refunded');

-- AlterTable
ALTER TABLE "CheckoutTransaction" ADD COLUMN     "paymentSession" TEXT;

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" INTEGER NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'primary',
    "name" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "hours" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "appointment" TEXT,
    "paymentProvider" TEXT,
    "idempotencyKeyHash" TEXT NOT NULL DEFAULT '',
    "status" "PaymentSessionStatusType" DEFAULT 'pending',
    "amount" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAmount" INTEGER DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_key_key" ON "ShopSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_idempotencyKeyHash_key" ON "PaymentSession"("idempotencyKeyHash");

-- CreateIndex
CREATE INDEX "PaymentSession_appointment_idx" ON "PaymentSession"("appointment");

-- CreateIndex
CREATE INDEX "PaymentSession_paymentProvider_idx" ON "PaymentSession"("paymentProvider");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutTransaction_paymentSession_key" ON "CheckoutTransaction"("paymentSession");

-- AddForeignKey
ALTER TABLE "CheckoutTransaction" ADD CONSTRAINT "CheckoutTransaction_paymentSession_fkey" FOREIGN KEY ("paymentSession") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
