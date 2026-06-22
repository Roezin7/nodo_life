import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PIN_INICIAL = process.env.SEED_PIN ?? '1234';
const NOMBRE = process.env.SEED_NOMBRE ?? 'Arturo';

async function main() {
  // 1) Usuario único (PIN hasheado).
  const total = await prisma.usuario.count();
  if (total === 0) {
    await prisma.usuario.create({ data: { nombre: NOMBRE, pin_hash: await bcrypt.hash(PIN_INICIAL, 10) } });
    console.log(`  + usuario ${NOMBRE} (PIN inicial: ${PIN_INICIAL})`);
  }

  // 2) Áreas de vida.
  const areas: { nombre: string; color: string; icono: string; orden: number }[] = [
    { nombre: 'Dinero', color: '#21A645', icono: 'wallet', orden: 1 },
    { nombre: 'Salud', color: '#FF3B21', icono: 'heart', orden: 2 },
    { nombre: 'Trabajo/Proyectos', color: '#1F8EF1', icono: 'briefcase', orden: 3 },
    { nombre: 'Crecimiento personal', color: '#FBA61A', icono: 'growth', orden: 4 },
  ];
  for (const a of areas) {
    await prisma.areas.upsert({ where: { nombre: a.nombre }, update: {}, create: a });
  }
  console.log('  + áreas de vida');

  // 3) Tipos de cuenta + cuentas iniciales del usuario.
  const tipos = ['Banco', 'Efectivo', 'Inversiones', 'Por cobrar'];
  const tipoId: Record<string, bigint> = {};
  for (const nombre of tipos) {
    const t = await prisma.tipos_cuenta.upsert({ where: { nombre }, update: {}, create: { nombre } });
    tipoId[nombre] = t.id;
  }
  const cuentas = [
    { nombre: 'Banco', tipo: 'Banco', es_central: true },
    { nombre: 'Efectivo', tipo: 'Efectivo', es_central: false },
    { nombre: 'Inversiones', tipo: 'Inversiones', es_central: false },
  ];
  for (const c of cuentas) {
    const existe = await prisma.cuentas.findFirst({ where: { nombre: c.nombre } });
    if (!existe) {
      await prisma.cuentas.create({ data: { nombre: c.nombre, tipo_id: tipoId[c.tipo]!, es_central: c.es_central } });
    }
  }
  console.log('  + tipos de cuenta y cuentas iniciales');

  // 4) Categorías genéricas (ingreso/gasto), ligadas a área cuando aplica.
  const dinero = await prisma.areas.findUnique({ where: { nombre: 'Dinero' } });
  const gastos = ['Súper/Comida', 'Restaurantes', 'Transporte', 'Servicios', 'Renta', 'Salud', 'Entretenimiento', 'Otros'];
  const ingresos = ['Sueldo', 'Negocios', 'Inversiones', 'Otros'];
  for (const nombre of gastos) {
    const existe = await prisma.categorias.findFirst({ where: { nombre, clase: 'gasto' } });
    if (!existe) await prisma.categorias.create({ data: { nombre, clase: 'gasto', area_id: dinero?.id ?? null } });
  }
  for (const nombre of ingresos) {
    const existe = await prisma.categorias.findFirst({ where: { nombre, clase: 'ingreso' } });
    if (!existe) await prisma.categorias.create({ data: { nombre, clase: 'ingreso', area_id: dinero?.id ?? null } });
  }
  console.log('  + categorías de ingreso/gasto');

  // 5) Tipos de entrenamiento.
  for (const nombre of ['Pesas', 'Correr', 'HIIT']) {
    await prisma.tipos_entrenamiento.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }
  console.log('  + tipos de entrenamiento (Pesas, Correr, HIIT)');

  console.log('\n✅ Seed completo. Cambia el PIN inicial desde la app cuanto antes.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
