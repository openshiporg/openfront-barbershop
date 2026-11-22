-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "requireBookingApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "taxRateBps" INTEGER DEFAULT 0;
