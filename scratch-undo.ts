import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const schema = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, column_default, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'UndoAction'
  `);
  console.log("UndoAction:", schema);
}
main().finally(() => prisma.$disconnect());
