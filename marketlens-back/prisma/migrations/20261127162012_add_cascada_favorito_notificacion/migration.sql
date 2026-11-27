-- DropForeignKey
ALTER TABLE "favoritos_negocio" DROP CONSTRAINT "favoritos_negocio_negocioId_fkey";

-- AddForeignKey
ALTER TABLE "favoritos_negocio" ADD CONSTRAINT "favoritos_negocio_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
