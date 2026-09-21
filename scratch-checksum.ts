import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const m = await prisma.$queryRawUnsafe(`SELECT migration_name, checksum FROM _prisma_migrations WHERE migration_name LIKE '%iswaste%' OR migration_name LIKE '%isWaste%'`);
  console.log(m);
}
main().finally(() => prisma.$disconnect());
