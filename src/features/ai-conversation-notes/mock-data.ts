import type { QuickTag, StructuredCallNotesData } from "./types";

export const DEFAULT_QUICK_TAGS: QuickTag[] = [
  "Interested",
  "Price Concern",
  "Follow-up Required",
  "Decision Maker",
  "No Response",
];

export interface MockNotePreset {
  id: string;
  label: string;
  description: string;
  rawNote: string;
  expectedResult: StructuredCallNotesData;
}

export const MOCK_NOTE_PRESETS: MockNotePreset[] = [
  {
    id: "ecommerce-partner",
    label: "E-commerce & Partner (Full)",
    description: "Rough notes with budget, partner decision factor, and Friday 4pm follow-up",
    rawNote: "interested ecommerce 25k budget talk with partner follow up friday 4pm",
    expectedResult: {
      requirement: "E-commerce Website",
      budget: "₹25,000",
      interestLevel: "High",
      decisionFactor: "Discuss with partner",
      objections: null, // Not provided
      importantDetails: null, // Not provided
      nextAction: "Follow up regarding proposal",
      suggestedFollowUpDate: "2026-09-18",
      suggestedFollowUpTime: "16:00",
      tags: ["Interested", "Follow-up Required"],
    },
  },
  {
    id: "price-concern-timeline",
    label: "Price Concern & Timeline",
    description: "Objections present, budget not yet decided, client is decision maker",
    rawNote: "client interested in mobile app redesign, budget not decided, main objection is price is high and timeline is tight, client is decision maker, follow up monday 11am",
    expectedResult: {
      requirement: "Mobile App Redesign",
      budget: null, // Not provided
      interestLevel: "Medium",
      decisionFactor: "Price and delivery timeline",
      objections: "Price is considered high and timeline is tight",
      importantDetails: "Client is the primary decision maker",
      nextAction: "Prepare revised estimate with phased milestones",
      suggestedFollowUpDate: "2026-09-21",
      suggestedFollowUpTime: "11:00",
      tags: ["Interested", "Price Concern", "Decision Maker", "Follow-up Required"],
    },
  },
  {
    id: "no-response-voicemail",
    label: "No Response / Voicemail",
    description: "Minimal attempt note, demonstrates missing fields gracefully",
    rawNote: "called 3 times no response left voicemail to check if still interested",
    expectedResult: {
      requirement: null, // Not provided
      budget: null, // Not provided
      interestLevel: "Low",
      decisionFactor: null, // Not provided
      objections: null, // Not provided
      importantDetails: "Called 3 times, left voicemail",
      nextAction: "Retry follow-up call tomorrow or send WhatsApp message",
      suggestedFollowUpDate: null, // Not provided
      suggestedFollowUpTime: null, // Not provided
      tags: ["No Response"],
    },
  },
];

/**
 * Isolated mock parser callback that simulates the future AI backend.
 * Strict rule: Never invents values if not mentioned in the raw note.
 * Returns null for missing fields so "Not provided" is displayed.
 */
export async function mockStructureNotesCallback(rawNote: string): Promise<StructuredCallNotesData> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 600));

  const trimmed = rawNote.trim().toLowerCase();

  // Check against preset templates
  for (const preset of MOCK_NOTE_PRESETS) {
    if (trimmed.includes(preset.rawNote.toLowerCase()) || preset.rawNote.toLowerCase().includes(trimmed)) {
      return { ...preset.expectedResult };
    }
  }

  // Heuristic extraction without hallucination
  const result: StructuredCallNotesData = {
    requirement: null,
    budget: null,
    interestLevel: null,
    decisionFactor: null,
    objections: null,
    importantDetails: null,
    nextAction: null,
    suggestedFollowUpDate: null,
    suggestedFollowUpTime: null,
    tags: [],
  };

  // Requirement heuristics
  if (trimmed.includes("ecommerce") || trimmed.includes("e-commerce")) {
    result.requirement = "E-commerce Website";
  } else if (trimmed.includes("app") || trimmed.includes("mobile")) {
    result.requirement = "Mobile App Development";
  } else if (trimmed.includes("crm") || trimmed.includes("software")) {
    result.requirement = "CRM Software Integration";
  } else if (trimmed.includes("website") || trimmed.includes("web design")) {
    result.requirement = "Website Design";
  }

  // Budget heuristics
  const budgetMatch = trimmed.match(/(?:budget\s*[:=]?\s*|₹\s*|inr\s*|rs\.?\s*)?(\d+)(?:\s*(k|lac|lakh|thousand))?/i);
  if (trimmed.includes("25k") || trimmed.includes("25000") || trimmed.includes("25,000")) {
    result.budget = "₹25,000";
  } else if (budgetMatch && (trimmed.includes("budget") || trimmed.includes("₹") || trimmed.includes("k"))) {
    const rawNum = budgetMatch[1];
    const unit = budgetMatch[2]?.toLowerCase();
    if (unit === "k") {
      result.budget = `₹${parseInt(rawNum, 10) * 1000}`;
    } else if (unit === "lac" || unit === "lakh") {
      result.budget = `₹${parseInt(rawNum, 10) * 100000}`;
    } else {
      result.budget = `₹${rawNum}`;
    }
  }

  // Interest Level heuristics
  if (trimmed.includes("very interested") || trimmed.includes("high interest") || trimmed.includes("eager")) {
    result.interestLevel = "High";
  } else if (trimmed.includes("interested")) {
    result.interestLevel = "High";
  } else if (trimmed.includes("not interested") || trimmed.includes("no response") || trimmed.includes("cold")) {
    result.interestLevel = "Low";
  } else if (trimmed.includes("thinking") || trimmed.includes("evaluating") || trimmed.includes("maybe")) {
    result.interestLevel = "Medium";
  }

  // Decision Factor heuristics
  if (trimmed.includes("partner") || trimmed.includes("talk with partner") || trimmed.includes("wife") || trimmed.includes("director")) {
    result.decisionFactor = "Discuss with partner / internal stakeholders";
  } else if (trimmed.includes("budget") && trimmed.includes("approval")) {
    result.decisionFactor = "Board / Finance budget approval";
  } else if (trimmed.includes("decision maker")) {
    result.decisionFactor = "Client is sole decision maker";
  }

  // Objections heuristics
  if (trimmed.includes("expensive") || trimmed.includes("price") || trimmed.includes("cost")) {
    result.objections = "Price sensitivity / cost concerns";
  } else if (trimmed.includes("timeline") || trimmed.includes("too tight") || trimmed.includes("deadline")) {
    result.objections = "Urgent deadline / timeline constraints";
  }

  // Important details heuristics
  if (trimmed.includes("voicemail") || trimmed.includes("called 3 times")) {
    result.importantDetails = "Attempted call 3 times, left voicemail";
  }

  // Next Action heuristics
  if (trimmed.includes("send proposal") || trimmed.includes("send quote") || trimmed.includes("quote")) {
    result.nextAction = "Send detailed proposal & pricing quote";
  } else if (trimmed.includes("follow up") || trimmed.includes("call back")) {
    result.nextAction = "Follow up call to review details";
  }

  // Follow-up Date/Time heuristics
  if (trimmed.includes("friday")) {
    result.suggestedFollowUpDate = "2026-09-18";
  } else if (trimmed.includes("monday")) {
    result.suggestedFollowUpDate = "2026-09-21";
  } else if (trimmed.includes("tomorrow")) {
    result.suggestedFollowUpDate = "2026-09-16";
  }

  if (trimmed.includes("4pm") || trimmed.includes("4 pm") || trimmed.includes("16:00")) {
    result.suggestedFollowUpTime = "16:00";
  } else if (trimmed.includes("11am") || trimmed.includes("11 am")) {
    result.suggestedFollowUpTime = "11:00";
  } else if (trimmed.includes("10am") || trimmed.includes("10 am")) {
    result.suggestedFollowUpTime = "10:00";
  }

  // Tags
  const extractedTags: QuickTag[] = [];
  if (result.interestLevel === "High") extractedTags.push("Interested");
  if (result.objections && result.objections.toLowerCase().includes("price")) extractedTags.push("Price Concern");
  if (result.suggestedFollowUpDate || trimmed.includes("follow up")) extractedTags.push("Follow-up Required");
  if (trimmed.includes("decision maker")) extractedTags.push("Decision Maker");
  if (trimmed.includes("no response") || trimmed.includes("voicemail")) extractedTags.push("No Response");

  result.tags = extractedTags;

  return result;
}
