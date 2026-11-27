import { IsBoolean, IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { FuenteDato } from '@prisma/client';

export class QueryNegocioDto {
  @IsString()
  @IsOptional()
  categoriaId?: string;

  @IsBoolean({ message: 'oculto debe ser un booleano.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  oculto?: boolean;

  @IsEnum(FuenteDato, { message: `fuente debe ser uno de: ${Object.values(FuenteDato).join(', ')}.` })
  @IsOptional()
  fuente?: FuenteDato;

  @IsLatitude({ message: 'La latitud debe ser un número entre -90 y 90.' })
  @IsOptional()
  @Type(() => Number)
  lat?: number;

  @IsLongitude({ message: 'La longitud debe ser un número entre -180 y 180.' })
  @IsOptional()
  @Type(() => Number)
  lng?: number;

  @IsInt({ message: 'radioMetros debe ser un número entero.' })
  @IsPositive({ message: 'radioMetros debe ser mayor a 0.' })
  @IsOptional()
  @Type(() => Number)
  radioMetros?: number;

  @IsInt({ message: 'page debe ser un número entero.' })
  @IsPositive({ message: 'page debe ser mayor a 0.' })
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt({ message: 'limit debe ser un número entero.' })
  @IsPositive({ message: 'limit debe ser mayor a 0.' })
  @Max(50, { message: 'limit no puede exceder 50.' })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
