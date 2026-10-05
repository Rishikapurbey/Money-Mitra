-- AlterTable
ALTER TABLE "RecurringTransaction" ADD COLUMN     "frequency" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "monthOfYear" INTEGER,
ALTER COLUMN "amount" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BillPayment" (
    "id" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recurringId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BillPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillReminder" (
    "id" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "stage" TEXT NOT NULL,
    "recurringId" TEXT NOT NULL,

    CONSTRAINT "BillReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillPayment_userId_dueDate_idx" ON "BillPayment"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "BillReminder_recurringId_dueDate_stage_key" ON "BillReminder"("recurringId", "dueDate", "stage");

-- AddForeignKey
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillReminder" ADD CONSTRAINT "BillReminder_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
