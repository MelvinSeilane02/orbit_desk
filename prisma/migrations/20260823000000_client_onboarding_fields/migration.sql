-- Splits Client.primaryContact into first/surname (orbit-desk-master-build-prompt.md
-- §7a's field-level wording) and adds an explicit onboardingComplete boolean,
-- persisted alongside the derived onboardingStatus enum (unchanged values).
-- All existing data is disposable local seed data (prisma/seed.ts wipes and
-- reseeds every run), so this drops primaryContact outright rather than
-- attempting a data migration.

ALTER TABLE "clients" DROP COLUMN "primaryContact";
ALTER TABLE "clients" ADD COLUMN "primaryContactFirstName" TEXT;
ALTER TABLE "clients" ADD COLUMN "primaryContactSurname" TEXT;
ALTER TABLE "clients" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;
