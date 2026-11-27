-- CreateEnum
CREATE TYPE "FuenteDato" AS ENUM ('LEVANTAMIENTO', 'OSM');

-- AlterTable
ALTER TABLE "negocios" ADD COLUMN     "fuente" "FuenteDato" NOT NULL DEFAULT 'LEVANTAMIENTO';
