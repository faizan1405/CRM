import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const migrations = await prisma.$queryRawUnsafe("SELECT migration_name, finished_at, rolled_back_at, logs FROM _prisma_migrations ORDER BY finished_at ASC");
  console.log(JSON.stringify(migrations, null, 2));
}
main().finally(() => prisma.$disconnect());
