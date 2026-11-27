import { IsDefined, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class CreateNegocioDto {
  @IsString()
  nombre: string;

  @IsString()
  categoriaId: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsDefined({ message: 'La latitud es obligatoria.' })
  @IsLatitude({ message: 'La latitud debe ser un número entre -90 y 90.' })
  lat: number;

  @IsDefined({ message: 'La longitud es obligatoria.' })
  @IsLongitude({ message: 'La longitud debe ser un número entre -180 y 180.' })
  lng: number;

  @IsString()
  @IsOptional()
  direccion?: string;
}
