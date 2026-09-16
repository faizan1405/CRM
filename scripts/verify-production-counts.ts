import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const leads = await db.lead.count();
  const followUps = await db.followUp.count();
  const pendingFollowUps = await db.followUp.count({ where: { status: "PENDING" } });
  const lost = await db.lead.count({ where: { status: "LOST" } });
  const won = await db.lead.count({ where: { status: "WON" } });
  const waste = await db.lead.count({ where: { isWaste: true } });
  const wasteAndLost = await db.lead.count({ where: { isWaste: true, status: "LOST" } });
  const demoLeads = await db.lead.count({
    where: {
      OR: [
        { name: { contains: "DEMO", mode: "insensitive" } },
        { notes: { contains: "DEMO", mode: "insensitive" } },
        { business: { contains: "DEMO", mode: "insensitive" } },
        { email: { contains: "demo", mode: "insensitive" } },
        { email: { contains: "test", mode: "insensitive" } },
      ],
    },
  });

  const wasteLossEvents = await db.leadLossEvent.count({ where: { lead: { isWaste: true } } });
  const nonWasteLossEvents = await db.leadLossEvent.count({ where: { lead: { isWaste: false } } });
  const wasteFollowUps = await db.followUp.count({ where: { lead: { isWaste: true } } });
  const wonFollowUps = await db.followUp.count({ where: { lead: { status: "WON" } } });
  const lostFollowUps = await db.followUp.count({ where: { lead: { status: "LOST" } } });

  console.log("=== PRODUCTION DATA VERIFICATION ===");
  console.log("Leads total:                   ", leads);
  console.log("FollowUps total:               ", followUps);
  console.log("Pending FollowUps:             ", pendingFollowUps);
  console.log("LOST status count:             ", lost);
  console.log("WON status count:              ", won);
  console.log("Waste flag count (isWaste):    ", waste);
  console.log("Waste with status LOST:        ", wasteAndLost);
  console.log("Waste with LossEvents:         ", wasteLossEvents);
  console.log("Non-Waste with LossEvents:     ", nonWasteLossEvents);
  console.log("FollowUps on Waste:            ", wasteFollowUps);
  console.log("FollowUps on Won:              ", wonFollowUps);
  console.log("FollowUps on Lost:             ", lostFollowUps);
  console.log("Demo/Test Leads in Production: ", demoLeads);
  const allStatuses = await db.lead.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const wasteLeads = await db.lead.findMany({
    where: { isWaste: true },
    select: { id: true, name: true, phone: true, status: true, isWaste: true, notes: true, leadSource: true }
  });

  const nonWasteLost = await db.lead.findMany({
    where: { status: "LOST", isWaste: false },
    select: { id: true, name: true, phone: true, status: true, isWaste: true, notes: true }
  });

  console.log("All Status Distribution:      ", JSON.stringify(allStatuses));
  console.log("Non-Waste LOST count:         ", nonWasteLost.length);
  console.log("Non-Waste LOST Leads:         ", JSON.stringify(nonWasteLost, null, 2));
  console.log("Waste Leads Details:          ", JSON.stringify(wasteLeads, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());
