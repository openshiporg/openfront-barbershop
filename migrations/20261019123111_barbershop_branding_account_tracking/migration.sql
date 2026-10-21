-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "account" TEXT;

-- AlterTable
ALTER TABLE "GuestBookingCommand" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "logoColor" TEXT NOT NULL DEFAULT '0',
ADD COLUMN     "logoIcon" TEXT NOT NULL DEFAULT '<svg xmlns="http://www.w3.org/2000/svg" fill="none" height="100%" width="100%" viewBox="0 0 42 48"><path fill="#155eef" fill-rule="evenodd" d="m22.102 20.86 9.9-9.9L29.88 8.84l-7.339 7.339V3h-3v13.178l-7.339-7.34-2.121 2.122 9.9 9.9 1.06 1.06zm2.12 2.121 9.9-9.9 2.121 2.122-7.339 7.339H42v3H28.904l7.34 7.339L34.121 35l-9.9-9.899-1.06-1.06zM7.96 35.001l9.9-9.899 1.06-1.06-1.06-1.061-9.9-9.9-2.121 2.122 7.339 7.339H.002v3h13.176l-7.34 7.339zm12.02-7.777-9.9 9.9 2.122 2.12 7.339-7.338V45h3V31.906l7.339 7.338L32 37.124l-9.9-9.9-1.06-1.061z" clip-rule="evenodd"/></svg>';

-- Root Prisma6 expects an implicit-join PK. Reuse the existing unique index;
-- preserve every historical join row and all pre-existing migration bytes.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_index WHERE indexrelid = '"_Barber_specialties_AB_unique"'::regclass AND indisunique AND indisvalid AND indnatts = 2) THEN
    RAISE EXCEPTION 'Expected valid unique specialties pair index';
  END IF;
END $$;
ALTER TABLE "_Barber_specialties" ADD CONSTRAINT "_Barber_specialties_AB_pkey" PRIMARY KEY USING INDEX "_Barber_specialties_AB_unique";

-- CreateIndex
CREATE INDEX "Appointment_account_idx" ON "Appointment"("account");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_account_fkey" FOREIGN KEY ("account") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
