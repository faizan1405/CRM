import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const allLeads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' }
    });

    console.log("=== 1. PRODUCTION LEAD RECONCILIATION ===");
    console.log(`Current production count: ${allLeads.length}`);
    
    // Get the 3 newest leads
    const newestLeads = allLeads.slice(0, 3).map(l => ({
      createdAt: l.createdAt,
      name: l.name,
      status: l.status,
      isWaste: l.isWaste,
      leadSource: l.leadSource,
      email: l.email // I will look at email/name to determine demo
    }));

    console.log(JSON.stringify(newestLeads, null, 2));

    let demoCount = 0;
    const isDemo = (l: any) => {
      const s = `${l.name} ${l.email}`.toLowerCase();
      return s.includes('test') || s.includes('demo') || s.includes('sample');
    };

    allLeads.forEach(l => {
      if (isDemo(l)) demoCount++;
    });

    console.log("\n=== 2. VERIFY CURRENT PRODUCTION COUNTS ===");
    console.log(`Total Leads: ${allLeads.length}`);
    
    const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'];
    statuses.forEach(s => {
      console.log(`${s}: ${allLeads.filter(l => l.status === s).length}`);
    });
    
    console.log(`Waste: ${allLeads.filter(l => l.isWaste).length}`);
    console.log(`Demo/Test: ${demoCount}`);
    
    const phones = allLeads.map(l => l.phone).filter(Boolean);
    const uniquePhones = new Set(phones);
    console.log(`Duplicate phones: ${phones.length - uniquePhones.size}`);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
