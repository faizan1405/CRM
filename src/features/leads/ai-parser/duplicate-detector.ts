import { db } from "@/lib/db";
import { normalizePhone } from "./phone-utils";
import { statusFromDatabase, type DatabaseLeadStatus } from "@/features/leads/types";
import type {
  StructuredLeadDraft,
  DuplicateLeadCandidate,
  BulkLeadDraftItem,
  BulkLeadItemStatus,
  BulkLeadReviewDTO,
} from "./types";

/**
 * Searches the database for a potential duplicate lead matching the given draft.
 * Checks: 1. Phone number, 2. Email, 3. Name + Business.
 */
export async function findPossibleDuplicateLead(
  draft: StructuredLeadDraft
): Promise<DuplicateLeadCandidate | null> {
  // 1. Primary signal: Normalized phone number
  if (draft.phone) {
    const normalized = normalizePhone(draft.phone);
    if (normalized && normalized.comparisonDigits && normalized.comparisonDigits.length >= 7) {
      const targetDigits = normalized.comparisonDigits;

      // Query database for matching phone numbers (matching last 5 or first 5 digits to handle formatted spaces)
      const candidates = await db.lead.findMany({
        where: {
          OR: [
            { phone: { contains: targetDigits } },
            { phone: { contains: targetDigits.slice(-5) } },
            { phone: { contains: targetDigits.slice(0, 5) } },
          ],
        },
        select: {
          id: true,
          name: true,
          phone: true,
          business: true,
          status: true,
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      });

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

/**
 * Analyzes an array of structured drafts against the database AND in-batch duplicates.
 * Returns a BulkLeadReviewDTO with item statuses (READY, DUPLICATE_PHONE, DUPLICATE_EMAIL, INVALID, NEEDS_REVIEW).
 */
export async function analyzeBulkLeadDuplicates(
  drafts: StructuredLeadDraft[]
): Promise<BulkLeadReviewDTO> {
  const seenPhonesInBatch = new Map<string, number>(); // comparisonDigits -> draft index
  const seenEmailsInBatch = new Map<string, number>(); // email -> draft index

  const reviewedDrafts: BulkLeadDraftItem[] = [];

  let validCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const clientItemId = `bulk_draft_${i + 1}_${Date.now()}`;
    const validationErrors: string[] = [];

    // Validation checks
    const hasPhone = Boolean(draft.phone && draft.phone.trim());
    const hasName = Boolean(draft.name && draft.name.trim());
    const normPhone = draft.phone ? normalizePhone(draft.phone) : null;

    if (!hasPhone && !hasName) {
      validationErrors.push("Lead must have at least a valid name or phone number.");
    }

    if (draft.phone && normPhone && !normPhone.isValid) {
      validationErrors.push("Phone number format is invalid.");
    }

    // 1. Check in-batch duplicates
    let inBatchDuplicateCandidate: DuplicateLeadCandidate | null = null;
    let itemStatus: BulkLeadItemStatus = "READY";

    if (normPhone && normPhone.isValid && normPhone.comparisonDigits) {
      const targetDigits = normPhone.comparisonDigits;
      if (seenPhonesInBatch.has(targetDigits)) {
        const prevIdx = seenPhonesInBatch.get(targetDigits)!;
        inBatchDuplicateCandidate = {
          id: `batch_item_${prevIdx + 1}`,
          name: drafts[prevIdx].name || "Lead in this paste",
          phone: drafts[prevIdx].phone || targetDigits,
          business: drafts[prevIdx].business || null,
          status: "New",
          reason: `Duplicate phone number inside this paste (same as item #${prevIdx + 1})`,
          confidence: "high",
        };
        itemStatus = "DUPLICATE_PHONE";
      } else {
        seenPhonesInBatch.set(targetDigits, i);
      }
    }

    if (!inBatchDuplicateCandidate && draft.email && draft.email.trim()) {
      const emailLower = draft.email.trim().toLowerCase();
      if (seenEmailsInBatch.has(emailLower)) {
        const prevIdx = seenEmailsInBatch.get(emailLower)!;
        inBatchDuplicateCandidate = {
          id: `batch_item_${prevIdx + 1}`,
          name: drafts[prevIdx].name || "Lead in this paste",
          phone: drafts[prevIdx].phone || "",
          business: drafts[prevIdx].business || null,
          status: "New",
          reason: `Duplicate email inside this paste (same as item #${prevIdx + 1})`,
          confidence: "high",
        };
        itemStatus = "DUPLICATE_EMAIL";
      } else {
        seenEmailsInBatch.set(emailLower, i);
      }
    }

    // 2. If no in-batch duplicate, check DB duplicates
    let dbDuplicateCandidate: DuplicateLeadCandidate | null = null;
    if (!inBatchDuplicateCandidate) {
      dbDuplicateCandidate = await findPossibleDuplicateLead(draft);
      if (dbDuplicateCandidate) {
        if (dbDuplicateCandidate.reason?.includes("Phone")) {
          itemStatus = "DUPLICATE_PHONE";
        } else if (dbDuplicateCandidate.reason?.includes("Email")) {
          itemStatus = "DUPLICATE_EMAIL";
        } else {
          itemStatus = "NEEDS_REVIEW";
        }
      }
    }

    // Determine final status
    const possibleDuplicate = inBatchDuplicateCandidate || dbDuplicateCandidate;

    if (validationErrors.length > 0 && !hasPhone && !hasName) {
      itemStatus = "INVALID";
      invalidCount++;
    } else if (possibleDuplicate) {
      duplicateCount++;
    } else if (draft.confidence && Object.values(draft.confidence).includes("review")) {
      itemStatus = "READY";
      validCount++;
    } else {
      itemStatus = "READY";
      validCount++;
    }

    reviewedDrafts.push({
      ...draft,
      id: clientItemId,
      itemStatus,
      possibleDuplicate,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    });
  }

  return {
    drafts: reviewedDrafts,
    totalCount: drafts.length,
    validCount,
    duplicateCount,
    invalidCount,
  };
}
