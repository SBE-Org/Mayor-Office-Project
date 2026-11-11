-- Appointments linked to a case (case officer appointments)
ALTER TABLE "Appointment" ADD COLUMN "caseId" TEXT;

CREATE INDEX "Appointment_caseId_idx" ON "Appointment"("caseId");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
