-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coverPreset" TEXT,
ADD COLUMN     "coverUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CoverPhoto" (
    "userId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,

    CONSTRAINT "CoverPhoto_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "CoverPhoto" ADD CONSTRAINT "CoverPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

