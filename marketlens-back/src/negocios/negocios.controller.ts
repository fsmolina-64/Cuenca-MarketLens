import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';
import { NegocioService } from './negocios.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';
import { QueryNegocioDto } from './dto/query-negocio.dto';

type UsuarioRequest = Request & { user: { id: string; rol: string } };

@Controller('negocios')
export class NegocioController {
  constructor(private readonly negociosService: NegocioService) {}

  @Roles(Rol.ADMIN)
  @Post()
  create(@Body() dto: CreateNegocioDto, @Req() req: UsuarioRequest) {
    return this.negociosService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Query() dto: QueryNegocioDto) {
    return this.negociosService.findAll(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.negociosService.findOne(id);
  }

  @Roles(Rol.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNegocioDto, @Req() req: UsuarioRequest) {
    return this.negociosService.update(id, dto, req.user.id);
  }

  @Roles(Rol.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.negociosService.remove(id);
  }
}
