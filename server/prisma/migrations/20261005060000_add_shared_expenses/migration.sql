-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "shareId" TEXT;

-- CreateTable
CREATE TABLE "SharedExpense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT NOT NULL,
    "paidById" TEXT NOT NULL,

    CONSTRAINT "SharedExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseShare" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "expenseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "ExpenseShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "toMemberId" TEXT NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupActivity" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId" TEXT NOT NULL,
    "actorId" TEXT,

    CONSTRAINT "GroupActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedExpense_groupId_date_idx" ON "SharedExpense"("groupId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseShare_expenseId_memberId_key" ON "ExpenseShare"("expenseId", "memberId");

-- CreateIndex
CREATE INDEX "Settlement_groupId_idx" ON "Settlement"("groupId");

-- CreateIndex
CREATE INDEX "GroupActivity_groupId_createdAt_idx" ON "GroupActivity"("groupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_shareId_key" ON "Transaction"("shareId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "ExpenseShare"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedExpense" ADD CONSTRAINT "SharedExpense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SharedGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedExpense" ADD CONSTRAINT "SharedExpense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "GroupMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "SharedExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GroupMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SharedGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_fromMemberId_fkey" FOREIGN KEY ("fromMemberId") REFERENCES "GroupMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_toMemberId_fkey" FOREIGN KEY ("toMemberId") REFERENCES "GroupMember"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivity" ADD CONSTRAINT "GroupActivity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SharedGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivity" ADD CONSTRAINT "GroupActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

