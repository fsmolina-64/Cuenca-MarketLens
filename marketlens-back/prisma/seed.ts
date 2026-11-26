import 'dotenv/config';
import { PrismaClient, Rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function seed() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME;
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? '10');

  if (!adminEmail || !adminPassword || !adminUsername) {
    throw new Error(
      'Faltan variables de entorno: ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_USERNAME son requeridas.',
    );
  }

  const existingAdmin = await prisma.usuario.findFirst({
    where: { rol: Rol.ADMIN },
  });

  if (existingAdmin) {
    console.log('Ya existe al menos un usuario ADMIN. Saltando creación de admin.');
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    await prisma.usuario.create({
      data: {
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        rol: Rol.ADMIN,
      },
    });

    console.log('Usuario ADMIN creado correctamente.');
  }

  // --- Bloque 1: ZonaLimite ($executeRaw porque geometria es Unsupported) ---
  const geojsonCebollar = JSON.stringify({
    type: 'Polygon',
    coordinates: [[
      [-79.0256548, -2.8810797],
      [-79.0247025, -2.8819215],
      [-79.0231719, -2.8820311],
      [-79.0204103, -2.880122],
      [-79.0170259, -2.8791069],
      [-79.0126539, -2.8799901],
      [-79.0097524, -2.8811616],
      [-79.0063299, -2.883545],
      [-79.0103366, -2.8867159],
      [-79.0121963, -2.8880023],
      [-79.0141332, -2.88798],
      [-79.0184162, -2.8874741],
      [-79.0220959, -2.8875156],
      [-79.0256667, -2.8853132],
      [-79.0256548, -2.8810797]
    ]]
  });

  await prisma.$executeRaw`
    INSERT INTO zonas_limite (id, nombre, geometria)
    VALUES (${randomUUID()}, 'El Cebollar', ST_SetSRID(ST_GeomFromGeoJSON(${geojsonCebollar}), 4326))
    ON CONFLICT (nombre) DO NOTHING
  `;
  console.log('ZonaLimite "El Cebollar" verificada/creada.');

  // --- Bloque 2: Categorías (createMany normal) ---
  const categorias: { nombre: string; tipo: 'COMERCIO' | 'SERVICIO' }[] = [
    { nombre: 'Tienda de abarrotes', tipo: 'COMERCIO' },
    { nombre: 'Panadería', tipo: 'COMERCIO' },
    { nombre: 'Farmacia', tipo: 'COMERCIO' },
    { nombre: 'Ferretería', tipo: 'COMERCIO' },
    { nombre: 'Bazar/papelería', tipo: 'COMERCIO' },
    { nombre: 'Licorería', tipo: 'COMERCIO' },
    { nombre: 'Tienda de ropa', tipo: 'COMERCIO' },
    { nombre: 'Florería', tipo: 'COMERCIO' },
    { nombre: 'Restaurante', tipo: 'COMERCIO' },
    { nombre: 'Comida rápida', tipo: 'COMERCIO' },
    { nombre: 'Cafetería', tipo: 'COMERCIO' },
    { nombre: 'Peluquería/salón de belleza', tipo: 'SERVICIO' },
    { nombre: 'Lavandería', tipo: 'SERVICIO' },
    { nombre: 'Gimnasio', tipo: 'SERVICIO' },
    { nombre: 'Veterinaria', tipo: 'SERVICIO' },
    { nombre: 'Consultorio médico/odontológico', tipo: 'SERVICIO' },
    { nombre: 'Taller mecánico', tipo: 'SERVICIO' },
    { nombre: 'Banco/cooperativa', tipo: 'SERVICIO' },
    { nombre: 'Guardería/centro educativo', tipo: 'SERVICIO' },
  ];

  await prisma.categoria.createMany({
    data: categorias,
    skipDuplicates: true,
  });
  console.log(`Categorías verificadas/creadas: ${categorias.length}`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export default seed;
