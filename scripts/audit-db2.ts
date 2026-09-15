import { db } from '../src/lib/db';
async function run() {
  const allFollowUps = await db.followUp.count();
  const pendingFollowUps = await db.followUp.count({ where: { status: 'PENDING' } });
  const allLeads = await db.lead.count();
  console.log('All FollowUps:', allFollowUps);
  console.log('Pending FollowUps:', pendingFollowUps);
  console.log('All Leads:', allLeads);
}
run().catch(console.error).finally(() => process.exit(0));
