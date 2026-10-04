-- AlterTable
ALTER TABLE "User" ADD COLUMN     "netWorthReminder" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "NetWorthItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "NetWorthItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetWorthValue" (
    "id" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "NetWorthValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetWorthItem_userId_idx" ON "NetWorthItem"("userId");

-- CreateIndex
CREATE INDEX "NetWorthValue_itemId_recordedAt_idx" ON "NetWorthValue"("itemId", "recordedAt");

-- CreateIndex
CREATE INDEX "NetWorthValue_userId_recordedAt_idx" ON "NetWorthValue"("userId", "recordedAt");

-- AddForeignKey
ALTER TABLE "NetWorthItem" ADD CONSTRAINT "NetWorthItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetWorthValue" ADD CONSTRAINT "NetWorthValue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "NetWorthItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetWorthValue" ADD CONSTRAINT "NetWorthValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
