-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "groupId" TEXT;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SharedGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

