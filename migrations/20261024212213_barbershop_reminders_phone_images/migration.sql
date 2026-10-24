-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Barber" ADD COLUMN     "photo_extension" TEXT,
ADD COLUMN     "photo_filesize" INTEGER,
ADD COLUMN     "photo_height" INTEGER,
ADD COLUMN     "photo_id" TEXT,
ADD COLUMN     "photo_width" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "image_extension" TEXT,
ADD COLUMN     "image_filesize" INTEGER,
ADD COLUMN     "image_height" INTEGER,
ADD COLUMN     "image_id" TEXT,
ADD COLUMN     "image_width" INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "image_extension" TEXT,
ADD COLUMN     "image_filesize" INTEGER,
ADD COLUMN     "image_height" INTEGER,
ADD COLUMN     "image_id" TEXT,
ADD COLUMN     "image_width" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '';
