import { db } from '../src/lib/db';
async function run() {
  const followUps = await db.followUp.findMany({ where: { status: 'PENDING' } });
  const counts: Record<string, number> = {};
  followUps.forEach(f => {
    const d = new Date(f.scheduledAt);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')!.value;
    const m = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;
    const key = y + '-' + m + '-' + day;
    counts[key] = (counts[key] || 0) + 1;
  });
  console.log(counts);
}
run().catch(console.error).finally(() => process.exit(0));
