import { Prisma, LeadStatus, ActivityType, FollowUpType, FollowUpStatus, LeadLossReason, AIPriority, AIActionType } from "@prisma/client";
import { db } from "@/lib/db";

export const DEMO_TAG = "[DEMO]";

interface DemoLeadItem {
  name: string;
  phone: string;
  email: string;
  business?: string;
  industry?: string;
  budget: Prisma.Decimal;
  quotedAmount?: Prisma.Decimal;
  status: LeadStatus;
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  notes: string;
  insight: {
    score: number;
    priority: AIPriority;
    scoreReason: string;
    recommendedAction: string;
    recommendedActionType?: AIActionType;
  };
  followUp?: {
    scheduledAt: Date;
    type: FollowUpType;
    note: string;
  };
  lossEvent?: {
    reason: LeadLossReason;
    note: string;
  };
}

export async function seedDemoLeads(userId?: string): Promise<{ createdCount: number }> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const demoData: DemoLeadItem[] = [
    // 1. New Lead
    {
      name: `${DEMO_TAG} Rohan Mehra`,
      phone: "+91 98111 22334",
      email: "rohan.mehra.demo@example.com",
      business: "Mehra Retail Innovations",
      industry: "Retail",
      budget: new Prisma.Decimal("50000.00"),
      status: LeadStatus.NEW,
      notes: "Submitted Meta Ad Form for retail POS CRM integration.",
      insight: {
        score: 65,
        priority: AIPriority.NORMAL,
        scoreReason: "Fresh inquiry with clear retail software interest.",
        recommendedAction: "Initiate introductory discovery call.",
        recommendedActionType: AIActionType.CALL,
      },
    },
    // 2. Contacted
    {
      name: `${DEMO_TAG} Priya Sharma`,
      phone: "+91 98222 33445",
      email: "priya.sharma.demo@example.com",
      business: "Apex Digital Solutions",
      industry: "Digital Marketing",
      budget: new Prisma.Decimal("150000.00"),
      status: LeadStatus.CONTACTED,
      lastContactDate: now,
      notes: "Spoke with founder. Needs quotation for enterprise 10-seat plan.",
      insight: {
        score: 75,
        priority: AIPriority.IMPORTANT,
        scoreReason: "Decision maker actively evaluating team software.",
        recommendedAction: "Prepare customized scope of work.",
        recommendedActionType: AIActionType.REVIEW,
      },
    },
    // 3. Follow-up Required
    {
      name: `${DEMO_TAG} Amit Verma`,
      phone: "+91 98333 44556",
      email: "amit.verma.demo@example.com",
      business: "Verma Real Estate",
      industry: "Real Estate",
      budget: new Prisma.Decimal("200000.00"),
      status: LeadStatus.CONTACTED,
      lastContactDate: yesterday,
      nextFollowUpDate: tomorrow,
      notes: "Requested product demo walkthrough with sales team.",
      followUp: {
        scheduledAt: tomorrow,
        type: FollowUpType.CALL,
        note: "Conduct CRM demo walkthrough.",
      },
      insight: {
        score: 78,
        priority: AIPriority.IMPORTANT,
        scoreReason: "Demo scheduled with core management.",
        recommendedAction: "Confirm demo time and attendees.",
        recommendedActionType: AIActionType.WHATSAPP,
      },
    },
    // 4. Qualified
    {
      name: `${DEMO_TAG} Sneha Patel`,
      phone: "+91 98444 55667",
      email: "sneha.patel.demo@example.com",
      business: "Patel Global Logistics",
      industry: "Logistics",
      budget: new Prisma.Decimal("350000.00"),
      status: LeadStatus.QUALIFIED,
      lastContactDate: yesterday,
      notes: "Budget approved by board. Meets all technical prerequisites.",
      insight: {
        score: 82,
        priority: AIPriority.IMPORTANT,
        scoreReason: "High purchasing authority and confirmed budget allocation.",
        recommendedAction: "Draft formal commercial proposal.",
        recommendedActionType: AIActionType.EMAIL,
      },
    },
    // 5. Hot Lead
    {
      name: `${DEMO_TAG} Vikram Malhotra`,
      phone: "+91 98555 66778",
      email: "vikram.malhotra.demo@example.com",
      business: "Malhotra Enterprises",
      industry: "Manufacturing",
      budget: new Prisma.Decimal("500000.00"),
      status: LeadStatus.QUALIFIED,
      lastContactDate: now,
      notes: "High intent. Wants implementation kickoff by end of month.",
      insight: {
        score: 94,
        priority: AIPriority.CRITICAL,
        scoreReason: "Immediate decision timeframe with substantial budget.",
        recommendedAction: "Close deal with executive contract signing.",
        recommendedActionType: AIActionType.CALL,
      },
    },
    // 6. Proposal Sent
    {
      name: `${DEMO_TAG} Ananya Gupta`,
      phone: "+91 98666 77889",
      email: "ananya.gupta.demo@example.com",
      business: "Gupta Tech Labs",
      industry: "IT Services",
      budget: new Prisma.Decimal("220000.00"),
      quotedAmount: new Prisma.Decimal("220000.00"),
      status: LeadStatus.PROPOSAL_SENT,
      lastContactDate: yesterday,
      notes: "Formal proposal sent. Decision expected in 48 hours.",
      insight: {
        score: 80,
        priority: AIPriority.IMPORTANT,
        scoreReason: "Commercials under active client stakeholder review.",
        recommendedAction: "Send polite check-in via WhatsApp.",
        recommendedActionType: AIActionType.WHATSAPP,
      },
    },
    // 7. Converted / Won
    {
      name: `${DEMO_TAG} Rajesh Iyer`,
      phone: "+91 98777 88990",
      email: "rajesh.iyer.demo@example.com",
      business: "Iyer Cloud Systems",
      industry: "Cloud Infrastructure",
      budget: new Prisma.Decimal("450000.00"),
      quotedAmount: new Prisma.Decimal("450000.00"),
      status: LeadStatus.WON,
      lastContactDate: yesterday,
      notes: "Contract executed. Full payment advance received.",
      insight: {
        score: 100,
        priority: AIPriority.NORMAL,
        scoreReason: "Deal successfully won and closed.",
        recommendedAction: "Initiate client onboarding workflow.",
        recommendedActionType: AIActionType.OTHER,
      },
    },
    // 8. Lost (with valid LeadLossEvent)
    {
      name: `${DEMO_TAG} Sunita Rao`,
      phone: "+91 98888 99001",
      email: "sunita.rao.demo@example.com",
      business: "Rao Healthcare Supplies",
      industry: "Healthcare",
      budget: new Prisma.Decimal("100000.00"),
      status: LeadStatus.LOST,
      lastContactDate: twoDaysAgo,
      notes: "Client chose lower-tier competitor with cheaper pricing.",
      lossEvent: {
        reason: LeadLossReason.PRICE,
        note: "Competitor offered 40% discount on basic tier.",
      },
      insight: {
        score: 20,
        priority: AIPriority.NORMAL,
        scoreReason: "Lead closed as lost due to price constraints.",
        recommendedAction: "Schedule long-term nurture campaign in 6 months.",
        recommendedActionType: AIActionType.OTHER,
      },
    },
    // 9. No Response
    {
      name: `${DEMO_TAG} Deepak Joshi`,
      phone: "+91 98999 00112",
      email: "deepak.joshi.demo@example.com",
      business: "Joshi Consulting",
      industry: "Consulting",
      budget: new Prisma.Decimal("80000.00"),
      status: LeadStatus.CONTACTED,
      lastContactDate: twoDaysAgo,
      notes: "Multiple contact attempts made without response.",
      insight: {
        score: 40,
        priority: AIPriority.NORMAL,
        scoreReason: "Unresponsive prospect after multiple touchpoints.",
        recommendedAction: "Send final follow-up WhatsApp template before archiving.",
        recommendedActionType: AIActionType.WHATSAPP,
      },
    },
    // 10. Urgent Follow-up
    {
      name: `${DEMO_TAG} Kavita Nair`,
      phone: "+91 98000 11223",
      email: "kavita.nair.demo@example.com",
      business: "Nair FinTech Solutions",
      industry: "FinTech",
      budget: new Prisma.Decimal("600000.00"),
      status: LeadStatus.QUALIFIED,
      lastContactDate: twoDaysAgo,
      nextFollowUpDate: yesterday,
      notes: "Follow-up overdue for high-value FinTech opportunity.",
      followUp: {
        scheduledAt: twoDaysAgo,
        type: FollowUpType.CALL,
        note: "Overdue discussion regarding custom security compliance.",
      },
      insight: {
        score: 91,
        priority: AIPriority.CRITICAL,
        scoreReason: "High-value deal with overdue action required immediately.",
        recommendedAction: "Call client immediately to reschedule missed touchpoint.",
        recommendedActionType: AIActionType.CALL,
      },
    },
  ];

  let createdCount = 0;

  // Clean all previous demo leads first to guarantee a fresh deterministic seed
  await clearDemoLeads();

  for (const item of demoData) {
    // Delete any existing lead with same phone or email to avoid collisions
    await db.lead.deleteMany({
      where: {
        OR: [
          { phone: item.phone },
          { email: item.email },
        ],
      },
    });

    const lead = await db.lead.create({
      data: {
        name: item.name,
        phone: item.phone,
        email: item.email,
        business: item.business,
        industry: item.industry,
        budget: item.budget,
        quotedAmount: item.quotedAmount ?? null,
        status: item.status,
        lastContactDate: item.lastContactDate ?? null,
        nextFollowUpDate: item.nextFollowUpDate ?? null,
        notes: item.notes,
        activities: {
          create: {
            type: ActivityType.LEAD_CREATED,
            message: `Demo lead created: ${item.name}`,
            createdByUserId: userId ?? null,
          },
        },
        aiInsight: {
          create: {
            score: item.insight.score,
            priority: item.insight.priority,
            scoreReason: item.insight.scoreReason,
            recommendedAction: item.insight.recommendedAction,
            recommendedActionType: item.insight.recommendedActionType,
            needsRefresh: false,
          },
        },
      },
    });

    if (item.followUp) {
      const fu = item.followUp;
      await db.followUp.create({
        data: {
          leadId: lead.id,
          scheduledAt: fu.scheduledAt,
          type: fu.type,
          note: fu.note,
          status: FollowUpStatus.PENDING,
        },
      });
    }

    if (item.lossEvent) {
      const le = item.lossEvent;
      await db.leadLossEvent.create({
        data: {
          leadId: lead.id,
          reason: le.reason,
          note: le.note,
          lostAt: now,
          createdByUserId: userId ?? null,
        },
      });
    }

    createdCount++;
  }

  return { createdCount };
}

export async function clearDemoLeads(): Promise<{ deletedCount: number }> {
  const demoLeads = await db.lead.findMany({
    where: {
      OR: [
        { name: { startsWith: DEMO_TAG } },
        { email: { endsWith: ".demo@example.com" } },
        { email: { contains: ".demo@" } },
      ],
    },
    select: { id: true },
  });

  const ids = demoLeads.map((l) => l.id);
  if (ids.length > 0) {
    await db.salesNotification.deleteMany({ where: { leadId: { in: ids } } });
    await db.leadLossEvent.deleteMany({ where: { leadId: { in: ids } } });
    await db.followUp.deleteMany({ where: { leadId: { in: ids } } });
    await db.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
    await db.leadAIInsight.deleteMany({ where: { leadId: { in: ids } } });
  }

  const deleteResult = await db.lead.deleteMany({
    where: {
      OR: [
        { name: { startsWith: DEMO_TAG } },
        { email: { endsWith: ".demo@example.com" } },
        { email: { contains: ".demo@" } },
      ],
    },
  });

  return { deletedCount: deleteResult.count };
}
