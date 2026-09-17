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
      notes: "Submitted inquiry for retail POS CRM integration.",
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
        recommendedAction: "Send calendar invite with meeting link.",
        recommendedActionType: AIActionType.CALL,
      },
    },
    // 4. Qualified Lead
    {
      name: `${DEMO_TAG} Sunita Rao`,
      phone: "+91 98444 55667",
      email: "sunita.rao.demo@example.com",
      business: "Rao Health Tech",
      industry: "Healthcare",
      budget: new Prisma.Decimal("300000.00"),
      status: LeadStatus.QUALIFIED,
      lastContactDate: yesterday,
      notes: "Technical requirements matched. Ready for commercial proposal.",
      insight: {
        score: 82,
        priority: AIPriority.CRITICAL,
        scoreReason: "Qualified decision maker with approved budget.",
        recommendedAction: "Send formal proposal with SLA terms.",
        recommendedActionType: AIActionType.REVIEW,
      },
    },
    // 5. Proposal Sent - High Value
    {
      name: `${DEMO_TAG} Vikram Malhotra`,
      phone: "+91 98555 66778",
      email: "vikram.malhotra.demo@example.com",
      business: "Malhotra Logistics Hub",
      industry: "Logistics",
      budget: new Prisma.Decimal("450000.00"),
      quotedAmount: new Prisma.Decimal("420000.00"),
      status: LeadStatus.PROPOSAL_SENT,
      lastContactDate: twoDaysAgo,
      notes: "Proposal of ₹4,20,000 sent for automated tracking suite.",
      insight: {
        score: 88,
        priority: AIPriority.CRITICAL,
        scoreReason: "High-value proposal pending board review.",
        recommendedAction: "Schedule proposal review call with CFO.",
        recommendedActionType: AIActionType.CALL,
      },
    },
    // 6. Proposal Sent - Follow-up Needed
    {
      name: `${DEMO_TAG} Neha Kapoor`,
      phone: "+91 98666 77889",
      email: "neha.kapoor.demo@example.com",
      business: "Kapoor EduConsulting",
      industry: "Education",
      budget: new Prisma.Decimal("120000.00"),
      quotedAmount: new Prisma.Decimal("110000.00"),
      status: LeadStatus.PROPOSAL_SENT,
      lastContactDate: twoDaysAgo,
      notes: "Proposal shared. Client evaluating options against competitors.",
      followUp: {
        scheduledAt: tomorrow,
        type: FollowUpType.WHATSAPP,
        note: "Follow up on proposal feedback via WhatsApp.",
      },
      insight: {
        score: 72,
        priority: AIPriority.IMPORTANT,
        scoreReason: "Quotation in hand, follow-up scheduled.",
        recommendedAction: "Send WhatsApp message addressing questions.",
        recommendedActionType: AIActionType.WHATSAPP,
      },
    },
    // 7. Won Deal
    {
      name: `${DEMO_TAG} Arjun Singhania`,
      phone: "+91 98777 88990",
      email: "arjun.singhania.demo@example.com",
      business: "Singhania FinTech",
      industry: "Financial Services",
      budget: new Prisma.Decimal("500000.00"),
      quotedAmount: new Prisma.Decimal("480000.00"),
      status: LeadStatus.WON,
      lastContactDate: now,
      notes: "Agreement signed. Annual subscription paid upfront.",
      insight: {
        score: 95,
        priority: AIPriority.NORMAL,
        scoreReason: "Deal successfully won.",
        recommendedAction: "Hand off to client onboarding team.",
        recommendedActionType: AIActionType.OTHER,
      },
    },
    // 8. Won Deal
    {
      name: `${DEMO_TAG} Deepika Joshi`,
      phone: "+91 98888 99001",
      email: "deepika.joshi.demo@example.com",
      business: "Joshi Hospitality Group",
      industry: "Hospitality",
      budget: new Prisma.Decimal("250000.00"),
      quotedAmount: new Prisma.Decimal("240000.00"),
      status: LeadStatus.WON,
      lastContactDate: yesterday,
      notes: "Onboarding initiated for 3 hotel properties.",
      insight: {
        score: 92,
        priority: AIPriority.NORMAL,
        scoreReason: "Deal won.",
        recommendedAction: "Schedule kick-off call with property managers.",
        recommendedActionType: AIActionType.CALL,
      },
    },
    // 9. Lost Deal
    {
      name: `${DEMO_TAG} Kabir Mehta`,
      phone: "+91 98999 00112",
      email: "kabir.mehta.demo@example.com",
      business: "Mehta Auto Components",
      industry: "Manufacturing",
      budget: new Prisma.Decimal("180000.00"),
      quotedAmount: new Prisma.Decimal("160000.00"),
      status: LeadStatus.LOST,
      lastContactDate: twoDaysAgo,
      notes: "Client decided to build an internal spreadsheet system.",
      lossEvent: {
        reason: LeadLossReason.PRICE,
        note: "Client chose DIY internal tooling due to budget freeze.",
      },
      insight: {
        score: 30,
        priority: AIPriority.NORMAL,
        scoreReason: "Deal lost to internal tooling / price constraint.",
        recommendedAction: "Add to quarterly re-engagement nurture list.",
        recommendedActionType: AIActionType.OTHER,
      },
    },
    // 10. Stale Lead
    {
      name: `${DEMO_TAG} Ananya Sen`,
      phone: "+91 98000 11223",
      email: "ananya.sen.demo@example.com",
      business: "Sen Creative Studio",
      industry: "Creative Agency",
      budget: new Prisma.Decimal("80000.00"),
      status: LeadStatus.CONTACTED,
      lastContactDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      notes: "No response after initial pricing discussion 10 days ago.",
      insight: {
        score: 45,
        priority: AIPriority.NORMAL,
        scoreReason: "Stale opportunity with 10 days of inactivity.",
        recommendedAction: "Send final check-in message before archiving.",
        recommendedActionType: AIActionType.WHATSAPP,
      },
    },
  ];

  let createdCount = 0;

  // Clean all previous demo leads first to guarantee a fresh deterministic seed
  await clearDemoLeads();

  let validUserId: string | null = null;
  if (userId) {
    const userExists = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (userExists) {
      validUserId = userExists.id;
    }
  }

  for (const item of demoData) {
    let phoneToUse = item.phone;
    const existing = await db.lead.findFirst({ where: { phone: phoneToUse } });
    if (existing) {
      phoneToUse = `${item.phone.slice(0, 10)}${createdCount}`;
    }

    try {
      await db.lead.create({
        data: {
          name: item.name,
          phone: phoneToUse,
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
              createdByUserId: validUserId,
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
          followUps: item.followUp
            ? {
                create: {
                  scheduledAt: item.followUp.scheduledAt,
                  type: item.followUp.type,
                  note: item.followUp.note,
                  status: FollowUpStatus.PENDING,
                },
              }
            : undefined,
          lossEvents: item.lossEvent
            ? {
                create: {
                  reason: item.lossEvent.reason,
                  note: item.lossEvent.note,
                  lostAt: now,
                  createdByUserId: validUserId,
                },
              }
            : undefined,
        },
      });
    } catch (err: unknown) {
      const isFk = err instanceof Error && (err.message.includes("Foreign key") || (err as { code?: string }).code === "P2003");
      if (isFk && validUserId) {
        validUserId = null;
        await db.lead.create({
          data: {
            name: item.name,
            phone: phoneToUse,
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
                createdByUserId: null,
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
            followUps: item.followUp
              ? {
                  create: {
                    scheduledAt: item.followUp.scheduledAt,
                    type: item.followUp.type,
                    note: item.followUp.note,
                    status: FollowUpStatus.PENDING,
                  },
                }
              : undefined,
            lossEvents: item.lossEvent
              ? {
                  create: {
                    reason: item.lossEvent.reason,
                    note: item.lossEvent.note,
                    lostAt: now,
                    createdByUserId: null,
                  },
                }
              : undefined,
          },
        });
      } else {
        throw err;
      }
    }

    createdCount++;
  }

  return { createdCount };
}

export async function clearDemoLeads(): Promise<{ deletedCount: number }> {
  const demoLeads = await db.lead.findMany({
    where: {
      name: { startsWith: DEMO_TAG },
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
      id: { in: ids },
    },
  });

  return { deletedCount: deleteResult.count };
}
