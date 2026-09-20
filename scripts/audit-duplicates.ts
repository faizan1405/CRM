import { db } from "../src/lib/db";
import { normalizePhone } from "../src/features/leads/ai-parser/phone-utils";

async function runAudit() {
  try {
    const leads = await db.lead.findMany({
      where: {
        deletedAt: null,
        mergedIntoLeadId: null,
      },
      select: {
        id: true,
        phone: true,
        email: true,
      },
    });

    const phoneGroups = new Map<string, string[]>();
    const emailGroups = new Map<string, string[]>();
    const leadsInvolved = new Set<string>();

    for (const lead of leads) {
      if (lead.phone) {
        const norm = normalizePhone(lead.phone);
        if (norm && norm.comparisonDigits && norm.comparisonDigits.length >= 7) {
          const key = norm.isIndian ? norm.comparisonDigits : `intl_${norm.comparisonDigits}`;
          const group = phoneGroups.get(key) || [];
          group.push(lead.id);
          phoneGroups.set(key, group);
        }
      }

      if (lead.email && lead.email.trim()) {
        const normEmail = lead.email.trim().toLowerCase();
        const group = emailGroups.get(normEmail) || [];
        group.push(lead.id);
        emailGroups.set(normEmail, group);
      }
    }

    let dupPhoneGroups = 0;
    for (const [, leadIds] of phoneGroups) {
      if (leadIds.length > 1) {
        dupPhoneGroups++;
        leadIds.forEach((id) => leadsInvolved.add(id));
      }
    }

    let dupEmailGroups = 0;
    for (const [, leadIds] of emailGroups) {
      if (leadIds.length > 1) {
        dupEmailGroups++;
        leadIds.forEach((id) => leadsInvolved.add(id));
      }
    }

    console.log("AUDIT_RESULT_START");
    console.log(`Phone duplicate groups: ${dupPhoneGroups}`);
    console.log(`Email duplicate groups: ${dupEmailGroups}`);
    console.log(`Total leads involved: ${leadsInvolved.size}`);
    console.log("AUDIT_RESULT_END");
  } catch (err) {
    console.error("Audit error:", err instanceof Error ? err.message : String(err));
  } finally {
    await db.$disconnect();
  }
}

runAudit();
