-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "barberChairNumberSnapshot" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "barberNameSnapshot" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "serviceImagePathSnapshot" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "serviceModifiersSnapshot" JSONB DEFAULT '[]',
ADD COLUMN     "serviceTitleSnapshot" TEXT NOT NULL DEFAULT '';
