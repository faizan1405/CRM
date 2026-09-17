import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const count = await prisma.lead.count();
  const demoCount = await prisma.lead.count({
    where: { email: { endsWith: '@example.com' } }
  });
  const leads = await prisma.lead.findMany();
  const phones = new Set();
  let duplicates = 0;
  for (const l of leads) {
    const normalized = l.phone.replace(/[^\d+]/g, '');
    if (phones.has(normalized)) duplicates++;
    else phones.add(normalized);
  }
  console.log(JSON.stringify({ total: count, demo: demoCount, duplicates }));
}
run().catch(console.error).finally(() => prisma.$disconnect());
