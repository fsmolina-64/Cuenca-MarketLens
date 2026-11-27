import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateNegocioDto } from './create-negocio.dto';

export class UpdateNegocioDto extends PartialType(CreateNegocioDto) {
  @IsBoolean({ message: 'oculto debe ser un booleano.' })
  @IsOptional()
  oculto?: boolean;
}
