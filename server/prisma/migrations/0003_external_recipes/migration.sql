-- AlterEnum
ALTER TYPE "RecipeOrigin" ADD VALUE 'external';

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalSource" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "videoUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_externalSource_externalId_key" ON "Recipe"("externalSource", "externalId");

