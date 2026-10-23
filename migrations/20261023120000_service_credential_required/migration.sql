-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "credentialRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable (default logo is the Untitled UI 45-degrees mark)
ALTER TABLE "Shop" ALTER COLUMN "logoIcon" SET DEFAULT '<svg fill="none" height="100%" viewBox="0 0 24 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m0 15.8981h17.3455l-17.061314 17.0613 2.756374 2.7564 17.06134-17.0613v17.3455h.1104l3.7877-3.7877v-15.9638l-4.2485-4.2485h-15.96596l-3.78553995 3.7855z" fill="#155eef"/></svg>';
