-- AlterTable
ALTER TABLE "AppointmentLineItem" ADD COLUMN     "barberChairNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "barberName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "modifiers" JSONB DEFAULT '[]',
ADD COLUMN     "packageBalanceId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "packageName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "packageVisitsConsumed" INTEGER DEFAULT 0;
