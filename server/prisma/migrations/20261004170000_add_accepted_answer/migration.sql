-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "acceptedReplyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Post_acceptedReplyId_key" ON "Post"("acceptedReplyId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_acceptedReplyId_fkey" FOREIGN KEY ("acceptedReplyId") REFERENCES "Reply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
