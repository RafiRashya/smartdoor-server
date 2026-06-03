-- CreateEnum
CREATE TYPE "FACE_STATUS" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "Face" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "imagePath" TEXT NOT NULL,
    "embedding" JSONB,
    "embeddingVersion" TEXT,
    "captureQuality" DOUBLE PRECISION,
    "sourceGatewayShortId" TEXT,
    "status" "FACE_STATUS" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Face_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceRoomAccess" (
    "id" TEXT NOT NULL,
    "faceId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaceRoomAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FaceRoomAccess_faceId_roomId_key" ON "FaceRoomAccess"("faceId", "roomId");

-- AddForeignKey
ALTER TABLE "Face" ADD CONSTRAINT "Face_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceRoomAccess" ADD CONSTRAINT "FaceRoomAccess_faceId_fkey" FOREIGN KEY ("faceId") REFERENCES "Face"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceRoomAccess" ADD CONSTRAINT "FaceRoomAccess_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
