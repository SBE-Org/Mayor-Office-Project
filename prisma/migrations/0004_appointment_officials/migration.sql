-- Appointment officials managed by the Super Administrator
ALTER TABLE "User" ADD COLUMN "appointmentLabel" TEXT;
ALTER TABLE "User" ADD COLUMN "appointmentOrder" INTEGER NOT NULL DEFAULT 0;
