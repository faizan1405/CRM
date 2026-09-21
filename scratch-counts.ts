import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const lc = await prisma.lead.count();
  const dc = await prisma.deal.count();
  const pc = await prisma.payment.count();
  const fc = await prisma.followUp.count();
  console.log(`Leads: ${lc}, Deals: ${dc}, Payments: ${pc}, FollowUps: ${fc}`);
}
main().finally(() => prisma.$disconnect());
