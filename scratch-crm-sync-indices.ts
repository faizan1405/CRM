import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const schema = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'CrmSyncState'
  `);
  console.log("Indices:", schema);
}
main().finally(() => prisma.$disconnect());
