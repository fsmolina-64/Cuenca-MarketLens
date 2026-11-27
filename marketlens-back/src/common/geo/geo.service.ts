import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

@Injectable()
export class GeoService {
  /**
   * Lanza 400 si lat/lng no son números válidos o están fuera de rango.
   */
  validarCoordenadas(lat: number, lng: number): void {
    if (typeof lat !== 'number' || Number.isNaN(lat) || lat < LAT_MIN || lat > LAT_MAX) {
      throw new BadRequestException(
        `Latitud inválida: ${lat}. Debe ser un número entre ${LAT_MIN} y ${LAT_MAX}.`,
      );
    }
    if (typeof lng !== 'number' || Number.isNaN(lng) || lng < LNG_MIN || lng > LNG_MAX) {
      throw new BadRequestException(
        `Longitud inválida: ${lng}. Debe ser un número entre ${LNG_MIN} y ${LNG_MAX}.`,
      );
    }
  }

  /**
   * Fragmento para ESCRIBIR un punto PostGIS.
   * PostGIS: ST_MakePoint(x, y) = ST_MakePoint(longitud, latitud) — orden invertido al habitual.
   */
  puntoSql(lat: number, lng: number): Prisma.Sql {
    this.validarCoordenadas(lat, lng);
    return Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
  }

  /**
   * Fragmento para LEER lat/lng desde una columna geometry(Point).
   * ST_X = longitud, ST_Y = latitud.
   * `columna` y `aliasTabla` son valores fijos del código (nunca input de usuario) —
   * se insertan como identificador SQL crudo, no como parámetro.
   * Sin aliasTabla: para usar en RETURNING (ahí no hay alias de tabla disponible).
   * Con aliasTabla: para usar en SELECT ... FROM ... alias.
   */
  seleccionarCoordenadas(columna = 'ubicacion', aliasTabla?: string): Prisma.Sql {
    const prefijo = aliasTabla ? `${aliasTabla}.` : '';
    return Prisma.raw(`ST_Y(${prefijo}${columna}) AS lat, ST_X(${prefijo}${columna}) AS lng`);
  }
}
