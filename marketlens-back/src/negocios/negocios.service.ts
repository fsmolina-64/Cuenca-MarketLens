import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GeoService } from '../common/geo/geo.service';
import { CreateNegocioDto } from './dto/create-negocio.dto';
import { UpdateNegocioDto } from './dto/update-negocio.dto';
import { QueryNegocioDto } from './dto/query-negocio.dto';

interface NegocioRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  oculto: boolean;
  fuente: string;
  creadoPorId: string;
  createdAt: Date;
  updatedAt: Date;
  lat: number | string;
  lng: number | string;
  categoria_id?: string;
  categoria_nombre?: string;
  categoria_tipo?: string;
}

interface CategoriaNegocio {
  id: string;
  nombre: string;
  tipo: string;
}

@Injectable()
export class NegocioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
  ) {}

  async create(dto: CreateNegocioDto, usuarioId: string) {
    // 1. La categoría debe existir.
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: dto.categoriaId },
    });
    if (!categoria) {
      throw new BadRequestException(
        `La categoría con id "${dto.categoriaId}" no existe.`,
      );
    }

    // 2. Coordenadas válidas (lanza 400 si no).
    this.geoService.validarCoordenadas(dto.lat, dto.lng);

    // 3. INSERT único con geometría y RETURNING (ubicacion es NOT NULL y Unsupported).
    const punto = this.geoService.puntoSql(dto.lat, dto.lng);
    const coords = this.geoService.seleccionarCoordenadas('ubicacion');

    const sql = Prisma.sql`
      INSERT INTO "negocios" (
        "nombre", "categoriaId", "descripcion", "ubicacion", "direccion", "creadoPorId"
      )
      VALUES (
        ${dto.nombre},
        ${dto.categoriaId},
        ${dto.descripcion ?? null},
        ${punto},
        ${dto.direccion ?? null},
        ${usuarioId}
      )
      RETURNING
        "id", "nombre", "categoriaId", "descripcion", "direccion", "creadoPorId",
        "createdAt", "updatedAt",
        ${coords}
    `;

    const rows: any[] = await this.prisma.$queryRaw(sql);
    const [row] = rows;
    if (!row) {
      throw new BadRequestException('No se pudo crear el negocio.');
    }

    return this.mapearNegocio(row, categoria);
  }

  async findAll(dto: QueryNegocioDto) {
    // Validación cruzada de parámetros de proximidad.
    const tieneLat = dto.lat !== undefined && dto.lat !== null;
    const tieneLng = dto.lng !== undefined && dto.lng !== null;
    const tieneRadio = dto.radioMetros !== undefined && dto.radioMetros !== null;

    if (tieneLat || tieneLng || tieneRadio) {
      if (!tieneLat || !tieneLng || !tieneRadio) {
        throw new BadRequestException(
          'Si se envía lat, lng o radioMetros, los tres son obligatorios.',
        );
      }
      this.geoService.validarCoordenadas(dto.lat!, dto.lng!);
    }

    const page = Math.max(dto.page ?? 1, 1);
    const limit = Math.min(Math.max(dto.limit ?? 20, 1), 50);
    const offset = (page - 1) * limit;

    // Condiciones WHERE dinámicas (valores interpolados, nunca concatenados).
    const condiciones: Prisma.Sql[] = [];
    if (dto.categoriaId) {
      condiciones.push(Prisma.sql`n."categoriaId" = ${dto.categoriaId}`);
    }
    if (dto.oculto !== undefined && dto.oculto !== null) {
      condiciones.push(Prisma.sql`n."oculto" = ${dto.oculto}`);
    }
    if (dto.fuente) {
      condiciones.push(Prisma.sql`n."fuente" = ${dto.fuente}`);
    }
    if (tieneLat && tieneLng && tieneRadio) {
      condiciones.push(
        Prisma.sql`ST_DWithin(
          n."ubicacion"::geography,
          ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography,
          ${dto.radioMetros}
        )`,
      );
    }

    const whereSql =
      condiciones.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
        : Prisma.sql``;

    const coords = this.geoService.seleccionarCoordenadas('ubicacion', 'n');

    const orderBySql = tieneLat && tieneLng && tieneRadio
      ? Prisma.sql`ORDER BY ST_Distance(
          n."ubicacion"::geography,
          ST_SetSRID(ST_MakePoint(${dto.lng}, ${dto.lat}), 4326)::geography
        ) ASC`
      : Prisma.sql`ORDER BY n."nombre" ASC`;

    const paginateSql = Prisma.sql`LIMIT ${limit} OFFSET ${offset}`;

    const dataSql = Prisma.sql`
      SELECT
        n."id", n."nombre", n."descripcion", n."direccion", n."oculto", n."fuente",
        n."creadoPorId", n."createdAt", n."updatedAt",
        ${coords},
        c."id" AS categoria_id, c."nombre" AS categoria_nombre, c."tipo" AS categoria_tipo
      FROM "negocios" n
      JOIN "categorias" c ON c."id" = n."categoriaId"
      ${whereSql}
      ${orderBySql}
      ${paginateSql}
    `;

    const countSql = Prisma.sql`
      SELECT COUNT(*) AS total
      FROM "negocios" n
      JOIN "categorias" c ON c."id" = n."categoriaId"
      ${whereSql}
    `;

    const dataRows: any[] = await this.prisma.$queryRaw(dataSql);
    const countRows: any[] = await this.prisma.$queryRaw(countSql);

    const total = Number(countRows[0]?.total ?? 0);

    return {
      data: dataRows.map((row) => this.mapearNegocio(row)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const row = await this.buscarNegocioRaw(id);
    if (!row) {
      throw new NotFoundException(`El negocio con id "${id}" no existe.`);
    }
    return this.mapearNegocio(row);
  }

  async update(id: string, dto: UpdateNegocioDto, usuarioId: string) {
    // 1. El negocio debe existir.
    const existente = await this.buscarNegocioRaw(id);
    if (!existente) {
      throw new NotFoundException(`El negocio con id "${id}" no existe.`);
    }

    // 2. Si se cambia la categoría, que exista.
    if (dto.categoriaId !== undefined && dto.categoriaId !== existente.categoria_id) {
      const categoria = await this.prisma.categoria.findUnique({
        where: { id: dto.categoriaId },
      });
      if (!categoria) {
        throw new BadRequestException(
          `La categoría con id "${dto.categoriaId}" no existe.`,
        );
      }
    }

    // 3. Si se toca la ubicación, deben venir lat y lng juntos y ser válidas.
    let punto: Prisma.Sql | undefined;
    if (dto.lat !== undefined || dto.lng !== undefined) {
      if (dto.lat === undefined || dto.lng === undefined) {
        throw new BadRequestException(
          'Para actualizar la ubicación se requieren lat y lng juntos.',
        );
      }
      this.geoService.validarCoordenadas(dto.lat, dto.lng);
      punto = this.geoService.puntoSql(dto.lat, dto.lng);
    }

    // 4. SET dinámico solo con los campos enviados.
    const sets: Prisma.Sql[] = [];
    const agregar = (columna: string, valor: unknown) => {
      sets.push(Prisma.sql`${Prisma.raw(`"${columna}"`)} = ${valor}`);
    };
    if (dto.nombre !== undefined) agregar('nombre', dto.nombre);
    if (dto.categoriaId !== undefined) agregar('categoriaId', dto.categoriaId);
    if (dto.descripcion !== undefined) agregar('descripcion', dto.descripcion ?? null);
    if (dto.direccion !== undefined) agregar('direccion', dto.direccion ?? null);
    if (dto.oculto !== undefined) agregar('oculto', dto.oculto);
    if (punto) sets.push(Prisma.sql`"ubicacion" = ${punto}`);

    if (sets.length === 0) {
      return this.findOne(id);
    }

    const coords = this.geoService.seleccionarCoordenadas('ubicacion', 'n');
    const sql = Prisma.sql`
      UPDATE "negocios"
      SET ${Prisma.join(sets, ', ')}
      WHERE "id" = ${id}
      RETURNING
        "id", "nombre", "categoriaId", "descripcion", "direccion", "oculto", "fuente",
        "creadoPorId", "createdAt", "updatedAt",
        ${coords}
    `;

    const rows: any[] = await this.prisma.$queryRaw(sql);
    const [row] = rows;
    if (!row) {
      throw new NotFoundException(`El negocio con id "${id}" no existe.`);
    }

    const categoriaIdFinal =
      dto.categoriaId ?? existente.categoria_id;
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: categoriaIdFinal },
    });

    return this.mapearNegocio(row, {
      id: categoria?.id ?? '',
      nombre: categoria?.nombre ?? '',
      tipo: categoria?.tipo ?? '',
    });
  }

  async remove(id: string) {
    // La migración de cascada (FavoritoNegocio → Cascade, Notificacion → SetNull)
    // ya está aplicada, por lo que delete funciona sin violar claves foráneas.
    const existe = await this.prisma.negocio.findUnique({ where: { id } });
    if (!existe) {
      throw new NotFoundException(`El negocio con id "${id}" no existe.`);
    }

    await this.prisma.negocio.delete({ where: { id } });
    return { message: 'Negocio eliminado correctamente.' };
  }

  /* ======================== privados ======================== */

  private async buscarNegocioRaw(id: string): Promise<NegocioRow | null> {
    const coords = this.geoService.seleccionarCoordenadas('ubicacion', 'n');
    const sql = Prisma.sql`
      SELECT
        n."id", n."nombre", n."descripcion", n."direccion", n."oculto", n."fuente",
        n."creadoPorId", n."createdAt", n."updatedAt",
        ${coords},
        c."id" AS categoria_id, c."nombre" AS categoria_nombre, c."tipo" AS categoria_tipo
      FROM "negocios" n
      JOIN "categorias" c ON c."id" = n."categoriaId"
      WHERE n."id" = ${id}
    `;
    const rows: any[] = await this.prisma.$queryRaw(sql);
    return (rows[0] as NegocioRow | undefined) ?? null;
  }

  private mapearNegocio(
    row: any,
    categoria?: CategoriaNegocio,
  ) {
    const cat = categoria ?? {
      id: row.categoria_id ?? row.categoriaId,
      nombre: row.categoria_nombre ?? '',
      tipo: row.categoria_tipo ?? '',
    };

    return {
      id: row.id,
      nombre: row.nombre,
      categoria: {
        id: cat.id,
        nombre: cat.nombre,
        tipo: cat.tipo,
      },
      descripcion: row.descripcion,
      lat: Number(row.lat),
      lng: Number(row.lng),
      direccion: row.direccion,
      oculto: row.oculto,
      fuente: row.fuente,
      creadoPorId: row.creadoPorId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
