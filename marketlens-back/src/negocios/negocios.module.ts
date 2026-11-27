import { Module } from '@nestjs/common';
import { NegocioController } from './negocios.controller';
import { NegocioService } from './negocios.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeoModule } from '../common/geo/geo.module';

@Module({
  imports: [GeoModule],
  controllers: [NegocioController],
  providers: [NegocioService, PrismaService],
})
export class NegocioModule {}
