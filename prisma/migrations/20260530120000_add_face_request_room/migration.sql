-- CreateEnum
CREATE TYPE "FACE_REQUEST_STATUS" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "Face_Request" (
    "id" TEXT NOT NULL,
    "faceId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "FACE_REQUEST_STATUS" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Face_Request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Face_Request_faceId_roomId_key" ON "Face_Request"("faceId", "roomId");

-- AddForeignKey
ALTER TABLE "Face_Request"
ADD CONSTRAINT "Face_Request_faceId_fkey"
FOREIGN KEY ("faceId") REFERENCES "Face"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Face_Request"
ADD CONSTRAINT "Face_Request_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id")
ON DELETE CASCADE ON UPDATE CASCADE;