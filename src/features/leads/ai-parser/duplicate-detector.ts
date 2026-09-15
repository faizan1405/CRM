import { db } from "@/lib/db";
import { normalizePhone } from "./phone-utils";
import { statusFromDatabase, type DatabaseLeadStatus } from "@/features/leads/types";
import type { StructuredLeadDraft, DuplicateLeadCandidate } from "./types";

export async function findPossibleDuplicateLead(
  draft: StructuredLeadDraft
): Promise<DuplicateLeadCandidate | null> {
  // 1. Primary signal: Normalized phone number
  if (draft.phone) {
    const normalized = normalizePhone(draft.phone);
    if (normalized && normalized.comparisonDigits && normalized.comparisonDigits.length >= 7) {
      const candidates = await db.lead.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          business: true,
          status: true,
        },
        take: 100,
        orderBy: { createdAt: "desc" },
      });

      const targetDigits = normalized.comparisonDigits;
      const matched = candidates.find((cand) => {
        const candNorm = normalizePhone(cand.phone);
        if (!candNorm || !candNorm.comparisonDigits) return false;
        return (
          candNorm.comparisonDigits === targetDigits ||
          candNorm.comparisonDigits.endsWith(targetDigits) ||
          targetDigits.endsWith(candNorm.comparisonDigits)
        );
      });

      if (matched) {
        return {
          id: matched.id,
          name: matched.name,
          phone: matched.phone,
          business: matched.business,
          status: statusFromDatabase[matched.status as DatabaseLeadStatus],
          reason: "Phone number matches an existing lead",
          confidence: "high",
        };
      }
    }
  }

  // 2. Secondary signal: Email address
  if (draft.email && draft.email.trim()) {
    const normalizedEmail = draft.email.trim().toLowerCase();
    const matched = await db.lead.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        business: true,
        status: true,
      },
    });

    if (matched) {
      return {
        id: matched.id,
        name: matched.name,
        phone: matched.phone,
        business: matched.business,
        status: statusFromDatabase[matched.status as DatabaseLeadStatus],
        reason: "Email matches an existing lead",
        confidence: "high",
      };
    }
  }

  // 3. Secondary signal: Name and business combination
  if (draft.name && draft.business && draft.name.trim() && draft.business.trim()) {
    const matched = await db.lead.findFirst({
      where: {
        name: {
          equals: draft.name.trim(),
          mode: "insensitive",
        },
        business: {
          equals: draft.business.trim(),
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        business: true,
        status: true,
      },
    });

    if (matched) {
      return {
        id: matched.id,
        name: matched.name,
        phone: matched.phone,
        business: matched.business,
        status: statusFromDatabase[matched.status as DatabaseLeadStatus],
        reason: "Name and business match an existing lead",
        confidence: "review",
      };
    }
  }

  return null;
}
