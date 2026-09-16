import { PrismaClient, LeadStatus } from "@prisma/client";

const db = new PrismaClient();

async function patchWasteStatus() {
  console.log("=== STARTING SAFE WASTE STATUS CORRECTION ===");

  // 1. Fetch exactly the records with isWaste=true and status=LOST
  const targetLeads = await db.lead.findMany({
    where: {
      isWaste: true,
      status: LeadStatus.LOST,
    },
    select: {
      id: true,
      notes: true,
      status: true,
      isWaste: true,
    },
  });

  console.log(`Found ${targetLeads.length} target waste leads with status=LOST.`);
  if (targetLeads.length !== 10) {
    console.warn(`WARNING: Expected 10 target leads, but found ${targetLeads.length}`);
  }

  // 2. Perform safe update inside transaction
  await db.$transaction(async (tx) => {
    // Also clean any accidental loss events on waste leads if any exist
    const deletedEvents = await tx.leadLossEvent.deleteMany({
      where: { lead: { isWaste: true } },
    });
    console.log(`Removed ${deletedEvents.count} erroneous LeadLossEvents on Waste leads.`);

    let updatedCount = 0;
    let newStatusCount = 0;
    let contactedStatusCount = 0;

    for (const lead of targetLeads) {
      const noteTrimmed = (lead.notes || "").trim();
      
      // Conservative mapping:
      // Blank/empty notes -> NEW
      // Any notes with engagement/call attempts/info -> CONTACTED
      const recoveredStatus = noteTrimmed === "" ? LeadStatus.NEW : LeadStatus.CONTACTED;

      await tx.lead.update({
        where: { id: lead.id },
        data: { status: recoveredStatus },
      });

      updatedCount++;
      if (recoveredStatus === LeadStatus.NEW) newStatusCount++;
      if (recoveredStatus === LeadStatus.CONTACTED) contactedStatusCount++;
    }

    console.log(`Updated ${updatedCount} Waste leads: ${newStatusCount} NEW, ${contactedStatusCount} CONTACTED.`);
  });

  // 3. Verification
  const totalLeads = await db.lead.count();
  const totalFollowUps = await db.followUp.count();
  const lostLeads = await db.lead.count({ where: { status: LeadStatus.LOST } });
  const wonLeads = await db.lead.count({ where: { status: LeadStatus.WON } });
  const wasteLeads = await db.lead.count({ where: { isWaste: true } });
  const wasteLostIntersection = await db.lead.count({
    where: { isWaste: true, status: LeadStatus.LOST },
  });
  const wasteLossEvents = await db.leadLossEvent.count({
    where: { lead: { isWaste: true } },
  });
  const nonWasteLossEvents = await db.leadLossEvent.count({
    where: { lead: { isWaste: false } },
  });

  const statusDistribution = await db.lead.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  console.log("=== AGGREGATE POST-PATCH VERIFICATION ===");
  console.log("Total Leads:                 ", totalLeads);
  console.log("Total FollowUps:             ", totalFollowUps);
  console.log("LOST Status Count:           ", lostLeads);
  console.log("WON Status Count:            ", wonLeads);
  console.log("Waste Count:                 ", wasteLeads);
  console.log("Waste + LOST Intersection:   ", wasteLostIntersection);
  console.log("Waste Loss Events:           ", wasteLossEvents);
  console.log("Non-Waste Loss Events:       ", nonWasteLossEvents);
  console.log("Status Distribution:         ", JSON.stringify(statusDistribution));
}

patchWasteStatus()
  .catch((err) => {
    console.error("Patch error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
