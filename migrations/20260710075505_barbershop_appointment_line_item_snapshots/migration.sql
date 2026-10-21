-- CreateTable
CREATE TABLE "AppointmentLineItem" (
    "id" TEXT NOT NULL,
    "appointment" TEXT,
    "transaction" TEXT,
    "service" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "price" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "imagePath" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentLineItem_appointment_idx" ON "AppointmentLineItem"("appointment");

-- CreateIndex
CREATE INDEX "AppointmentLineItem_transaction_idx" ON "AppointmentLineItem"("transaction");

-- CreateIndex
CREATE INDEX "AppointmentLineItem_service_idx" ON "AppointmentLineItem"("service");

-- AddForeignKey
ALTER TABLE "AppointmentLineItem" ADD CONSTRAINT "AppointmentLineItem_appointment_fkey" FOREIGN KEY ("appointment") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentLineItem" ADD CONSTRAINT "AppointmentLineItem_transaction_fkey" FOREIGN KEY ("transaction") REFERENCES "CheckoutTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentLineItem" ADD CONSTRAINT "AppointmentLineItem_service_fkey" FOREIGN KEY ("service") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
