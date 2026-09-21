import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe(`DELETE FROM _prisma_migrations WHERE migration_name = '20260915180000_add_iswaste'`);
  console.log("Deleted.");
}
main().finally(() => prisma.$disconnect());
