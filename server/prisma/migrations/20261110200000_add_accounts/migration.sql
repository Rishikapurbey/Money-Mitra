-- The main account becomes the default account: the one new Tracker entries start with
ALTER TABLE "NetWorthItem" RENAME COLUMN "isMain" TO "isDefault";

-- Which account each Tracker entry and recurring rule uses
ALTER TABLE "Transaction" ADD COLUMN "accountId" TEXT;
ALTER TABLE "RecurringTransaction" ADD COLUMN "accountId" TEXT;

CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "NetWorthItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "NetWorthItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Until now every entry moved the main account, so existing entries and rules belong to it.
-- People without a main account keep their entries with no account, which moves no balance.
UPDATE "Transaction" t SET "accountId" = i."id"
FROM "NetWorthItem" i
WHERE i."userId" = t."userId" AND i."isDefault" = true AND i."archivedAt" IS NULL;

UPDATE "RecurringTransaction" r SET "accountId" = i."id"
FROM "NetWorthItem" i
WHERE i."userId" = r."userId" AND i."isDefault" = true AND i."archivedAt" IS NULL;
