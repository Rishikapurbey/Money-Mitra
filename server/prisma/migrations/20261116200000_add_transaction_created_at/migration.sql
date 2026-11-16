-- AlterTable: existing entries count as added on their own date, so their effect on balances doesn't change
ALTER TABLE "Transaction" ADD COLUMN "createdAt" TIMESTAMP(3);
UPDATE "Transaction" SET "createdAt" = "date";
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
