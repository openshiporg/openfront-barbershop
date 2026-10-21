/*
  Warnings:

  - The primary key for the `_Barber_specialties` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_Barber_specialties` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Barber" ADD COLUMN     "imagePath" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imagePath" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "imagePath" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "_Barber_specialties" DROP CONSTRAINT "_Barber_specialties_AB_pkey";

-- CreateIndex
CREATE UNIQUE INDEX "_Barber_specialties_AB_unique" ON "_Barber_specialties"("A", "B");
