import { db } from "@/lib/db";
import { normalizePhone, type NormalizedPhone } from "./ai-parser/phone-utils";
import { statusFromDatabase, type DatabaseLeadStatus } from "@/features/leads/types";
import type { DuplicateLeadCandidate } from "./ai-entry-types";

export { normalizePhone };

/**
 * Normalizes an email address:
 * - trim whitespace
 * - lowercase
 */
export function normalizeEmail(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Checks if two phone numbers match according to CRM phone rules:
 * - Indian numbers match if they represent the same 10-digit number (e.g. 9876543210, +91 98765 43210, 91 9876543210, 09876543210).
 * - International numbers match only on exact normalized comparison digits (conservative, no blind 10-digit truncation).
 */
export function isPhoneMatch(phoneA: string | null | undefined, phoneB: string | null | undefined): boolean {
  const normA = normalizePhone(phoneA);
  const normB = normalizePhone(phoneB);
  if (!normA || !normB || !normA.isValid || !normB.isValid) return false;

  if (normA.isIndian && normB.isIndian) {
    return Boolean(
      normA.comparisonDigits &&
      normB.comparisonDigits &&
      normA.comparisonDigits === normB.comparisonDigits
    );
  }

  // If one is Indian and the other is not, they do not match unless both are 10-12 digits resolving to identical digits
  if (normA.isIndian !== normB.isIndian) {
    return false;
  }

  // International numbers: conservative exact comparisonDigits match
  return Boolean(
    normA.comparisonDigits &&
    normB.comparisonDigits &&
    normA.comparisonDigits === normB.comparisonDigits
  );
}

/**
 * Checks if two emails match.
 */
export function isEmailMatch(emailA: string | null | undefined, emailB: string | null | undefined): boolean {
  const normA = normalizeEmail(emailA);
  const normB = normalizeEmail(emailB);
  if (!normA || !normB) return false;
  return normA === normB;
}

export type DuplicateCheckInput = {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  business?: string | null;
};

export type DuplicateCheckOptions = {
  excludeLeadId?: string;
  checkDeleted?: boolean;
};

export function getDuplicateReason(
  matchedBy: "phone" | "email" | "phone_and_email",
  isDeleted = false
): string {
  if (isDeleted) {
    return "Matching lead exists in Recently Deleted";
  }
  switch (matchedBy) {
    case "phone_and_email":
      return "Phone number and email match an existing lead";
    case "phone":
      return "Phone number matches an existing lead";
    case "email":
      return "Email matches an existing lead";
  }
}

/**
 * Centralized duplicate detection service.
 *
 * Strong duplicate signals:
 * - Phone match (normalized)
 * - Email match (normalized)
 *
 * NOTE: Name/business alone NEVER triggers duplicate status.
 */
export async function findDuplicateLeadCandidates(
  input: DuplicateCheckInput,
  options?: DuplicateCheckOptions
): Promise<DuplicateLeadCandidate | null> {
  const excludeLeadId = options?.excludeLeadId;
  const checkDeleted = options?.checkDeleted ?? true;

  const normPhone = normalizePhone(input.phone);
  const normEmail = normalizeEmail(input.email);

  if (!normPhone?.comparisonDigits && !normEmail) {
    // No strong signal present to check
    return null;
  }

  const excludeWhere = excludeLeadId ? { id: { not: excludeLeadId } } : {};

  // 1. Check Active Leads (deletedAt: null AND mergedIntoLeadId: null)
  let activeCandidates: Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    business: string | null;
    status: string;
    createdAt: Date;
    activities?: { message: string; createdAt: Date }[];
  }> = [];

  const orConditions: Array<Record<string, unknown>> = [];
  if (normPhone?.comparisonDigits && normPhone.comparisonDigits.length >= 7) {
    const targetDigits = normPhone.comparisonDigits;
    orConditions.push(
      { phone: { contains: targetDigits } },
      { phone: { contains: targetDigits.slice(-5) } }
    );
  }

  if (normEmail) {
    orConditions.push({
      email: {
        equals: normEmail,
        mode: "insensitive",
      },
    });
  }

  if (orConditions.length > 0) {
    activeCandidates = await db.lead.findMany({
      where: {
        ...excludeWhere,
        deletedAt: null,
        mergedIntoLeadId: null,
        OR: orConditions,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        business: true,
        status: true,
        createdAt: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { message: true, createdAt: true },
        },
      },
      take: 25,
      orderBy: { createdAt: "desc" },
    });
  }

  // Evaluate candidate matches
  for (const candidate of activeCandidates) {
    const phoneMatched = normPhone && isPhoneMatch(normPhone.raw, candidate.phone);
    const emailMatched = normEmail && isEmailMatch(normEmail, candidate.email);

    if (phoneMatched || emailMatched) {
      const matchedBy = phoneMatched && emailMatched ? "phone_and_email" : phoneMatched ? "phone" : "email";
      const lastAct = candidate.activities?.[0];
      const lastActivityText = lastAct
        ? `${lastAct.message} (${new Date(lastAct.createdAt).toLocaleDateString()})`
        : null;

      return {
        id: candidate.id,
        name: candidate.name,
        phone: candidate.phone,
        email: candidate.email,
        business: candidate.business,
        status: statusFromDatabase[candidate.status as DatabaseLeadStatus] ?? candidate.status,
        confidence: "high",
        reason: getDuplicateReason(matchedBy, false),
        matchedBy,
        isDeleted: false,
        lastActivityText,
        createdAt: candidate.createdAt.toISOString(),
      };
    }
  }

  // 2. If no active match and checkDeleted is true, check soft-deleted leads
  if (checkDeleted && orConditions.length > 0) {
    const deletedCandidates = await db.lead.findMany({
      where: {
        ...excludeWhere,
        deletedAt: { not: null },
        mergedIntoLeadId: null,
        OR: orConditions,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        business: true,
        status: true,
        createdAt: true,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    for (const candidate of deletedCandidates) {
      const phoneMatched = normPhone && isPhoneMatch(normPhone.raw, candidate.phone);
      const emailMatched = normEmail && isEmailMatch(normEmail, candidate.email);

      if (phoneMatched || emailMatched) {
        const matchedBy = phoneMatched && emailMatched ? "phone_and_email" : phoneMatched ? "phone" : "email";
        return {
          id: candidate.id,
          name: candidate.name,
          phone: candidate.phone,
          email: candidate.email,
          business: candidate.business,
          status: statusFromDatabase[candidate.status as DatabaseLeadStatus] ?? candidate.status,
          confidence: "review",
          reason: getDuplicateReason(matchedBy, true),
          matchedBy,
          isDeleted: true,
          createdAt: candidate.createdAt.toISOString(),
        };
      }
    }
  }

  return null;
}

export type DuplicateGroup = {
  key: string;
  matchedBy: "phone" | "email";
  leadIds: string[];
  leads: Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    business: string | null;
    status: string;
    createdAt: string;
    isPinned: boolean;
  }>;
};

/**
 * Scans active CRM leads and returns groups of duplicates for the "Possible Duplicates" view.
 * Only strong phone or email matches are included.
 */
export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
  const activeLeads = await db.lead.findMany({
    where: {
      deletedAt: null,
      mergedIntoLeadId: null,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      business: true,
      status: true,
      createdAt: true,
      isPinned: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const phoneMap = new Map<string, typeof activeLeads>();
  const emailMap = new Map<string, typeof activeLeads>();

  for (const lead of activeLeads) {
    if (lead.phone) {
      const norm = normalizePhone(lead.phone);
      if (norm && norm.comparisonDigits && norm.isValid) {
        const key = norm.isIndian ? `in_${norm.comparisonDigits}` : `intl_${norm.comparisonDigits}`;
        const existing = phoneMap.get(key) || [];
        existing.push(lead);
        phoneMap.set(key, existing);
      }
    }

    if (lead.email) {
      const norm = normalizeEmail(lead.email);
      if (norm) {
        const existing = emailMap.get(norm) || [];
        existing.push(lead);
        emailMap.set(norm, existing);
      }
    }
  }

  const groups: DuplicateGroup[] = [];
  const processedPairs = new Set<string>();

  for (const [key, groupLeads] of phoneMap) {
    if (groupLeads.length > 1) {
      const pairKey = groupLeads.map((l) => l.id).sort().join(":");
      processedPairs.add(pairKey);
      groups.push({
        key: `phone_${key}`,
        matchedBy: "phone",
        leadIds: groupLeads.map((l) => l.id),
        leads: groupLeads.map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          email: l.email,
          business: l.business,
          status: statusFromDatabase[l.status as DatabaseLeadStatus] ?? l.status,
          createdAt: l.createdAt.toISOString(),
          isPinned: Boolean(l.isPinned),
        })),
      });
    }
  }

  for (const [key, groupLeads] of emailMap) {
    if (groupLeads.length > 1) {
      const pairKey = groupLeads.map((l) => l.id).sort().join(":");
      if (!processedPairs.has(pairKey)) {
        groups.push({
          key: `email_${key}`,
          matchedBy: "email",
          leadIds: groupLeads.map((l) => l.id),
          leads: groupLeads.map((l) => ({
            id: l.id,
            name: l.name,
            phone: l.phone,
            email: l.email,
            business: l.business,
            status: statusFromDatabase[l.status as DatabaseLeadStatus] ?? l.status,
            createdAt: l.createdAt.toISOString(),
            isPinned: Boolean(l.isPinned),
          })),
        });
      }
    }
  }

  return groups;
}
