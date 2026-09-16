import { describe, it, expect } from "vitest";
import { getLeadVisualState, getLeadCardTheme, LEAD_THEMES } from "@/features/leads/lead-card-theme";

describe("CRM Lead Card Color-Coding System", () => {
  const today = new Date().toISOString().slice(0, 10);
  const futureDate = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const pastDate = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);

  describe("1. Individual State Verification", () => {
    it("NEW LEAD -> Blue accent, very light blue bg, blue left border, badge: New", () => {
      const lead = { status: "New", quickStatus: "NONE" };
      const state = getLeadVisualState(lead);
      const theme = getLeadCardTheme(lead);

      expect(state).toBe("NEW");
      expect(theme.accentColor).toBe("blue");
      expect(theme.cardBg).toContain("bg-blue-50");
      expect(theme.leftBorder).toContain("border-l-blue-500");
      expect(theme.badgeLabel).toBe("New");
    });

    it("FOLLOW UP NOW -> Green accent, light green bg, green left border, badge: Follow up now", () => {
      const leadDueToday = { status: "New", nextFollowUpDate: today };
      const themeToday = getLeadCardTheme(leadDueToday);
      expect(getLeadVisualState(leadDueToday)).toBe("FOLLOW_UP_NOW");
      expect(themeToday.accentColor).toBe("green");
      expect(themeToday.cardBg).toContain("bg-emerald-50");
      expect(themeToday.leftBorder).toContain("border-l-emerald-500");
      expect(themeToday.badgeLabel).toBe("Follow up now");

      const leadOverdue = { status: "Contacted", nextFollowUpDate: pastDate };
      const themeOverdue = getLeadCardTheme(leadOverdue);
      expect(getLeadVisualState(leadOverdue)).toBe("FOLLOW_UP_NOW");
      expect(themeOverdue.accentColor).toBe("green");
    });

    it("FUTURE FOLLOW-UP -> Yellow/Amber accent, light yellow bg, amber left border, badge: Future follow-up", () => {
      const leadFuture = { status: "New", nextFollowUpDate: futureDate };
      const theme = getLeadCardTheme(leadFuture);

      expect(getLeadVisualState(leadFuture)).toBe("FUTURE_FOLLOW_UP");
      expect(theme.accentColor).toBe("yellow");
      expect(theme.cardBg).toContain("bg-amber-50");
      expect(theme.leftBorder).toContain("border-l-amber-500");
      expect(theme.badgeLabel).toBe("Future follow-up");
    });

    it("INTERESTED / QUALIFIED -> Purple accent, light purple bg, purple left border, badge: Interested", () => {
      const leadInterested = { status: "New", quickStatus: "INTERESTED" };
      const theme1 = getLeadCardTheme(leadInterested);
      expect(getLeadVisualState(leadInterested)).toBe("INTERESTED");
      expect(theme1.accentColor).toBe("purple");
      expect(theme1.cardBg).toContain("bg-purple-50");
      expect(theme1.leftBorder).toContain("border-l-purple-500");
      expect(theme1.badgeLabel).toBe("Interested");

      const leadQualified = { status: "Qualified", quickStatus: "NONE" };
      const theme2 = getLeadCardTheme(leadQualified);
      expect(getLeadVisualState(leadQualified)).toBe("INTERESTED");
      expect(theme2.accentColor).toBe("purple");
    });

    it("CONTACTED -> Lavender / soft indigo accent, subtle lavender bg, lavender left border, badge: Contacted", () => {
      const leadContacted = { status: "Contacted", quickStatus: "CONTACTED" };
      const theme = getLeadCardTheme(leadContacted);

      expect(getLeadVisualState(leadContacted)).toBe("CONTACTED");
      expect(theme.accentColor).toBe("lavender");
      expect(theme.cardBg).toContain("bg-indigo-50");
      expect(theme.leftBorder).toContain("border-l-indigo-400");
      expect(theme.badgeLabel).toBe("Contacted");
    });

    it("CALL NOT PICK -> Pink accent, light pink bg, pink left border, badge: Call not pick", () => {
      const leadCallNotPick = { status: "Contacted", quickStatus: "CALL_NOT_PICK" };
      const theme = getLeadCardTheme(leadCallNotPick);

      expect(getLeadVisualState(leadCallNotPick)).toBe("CALL_NOT_PICK");
      expect(theme.accentColor).toBe("pink");
      expect(theme.cardBg).toContain("bg-pink-50");
      expect(theme.leftBorder).toContain("border-l-pink-500");
      expect(theme.badgeLabel).toBe("Call not pick");
    });

    it("CALL AGAIN -> Soft violet accent, light violet bg, violet left border, badge: Call again", () => {
      const leadCallAgain = { status: "Contacted", quickStatus: "CALL_AGAIN" };
      const theme = getLeadCardTheme(leadCallAgain);

      expect(getLeadVisualState(leadCallAgain)).toBe("CALL_AGAIN");
      expect(theme.accentColor).toBe("violet");
      expect(theme.cardBg).toContain("bg-violet-50");
      expect(theme.leftBorder).toContain("border-l-violet-500");
      expect(theme.badgeLabel).toBe("Call again");
    });

    it("PROPOSAL SENT -> Indigo accent, light indigo bg, indigo left border, badge: Proposal sent", () => {
      const leadProposal = { status: "Proposal Sent" };
      const theme = getLeadCardTheme(leadProposal);

      expect(getLeadVisualState(leadProposal)).toBe("PROPOSAL_SENT");
      expect(theme.accentColor).toBe("indigo");
      expect(theme.cardBg).toContain("bg-indigo-50");
      expect(theme.leftBorder).toContain("border-l-indigo-500");
      expect(theme.badgeLabel).toBe("Proposal sent");
    });

    it("WON -> Emerald accent, light emerald bg, stronger emerald left border, badge: Won", () => {
      const leadWon = { status: "Won" };
      const theme = getLeadCardTheme(leadWon);

      expect(getLeadVisualState(leadWon)).toBe("WON");
      expect(theme.accentColor).toBe("emerald");
      expect(theme.cardBg).toContain("bg-emerald-50");
      expect(theme.leftBorder).toContain("border-l-emerald-600");
      expect(theme.badgeLabel).toBe("Won");
    });

    it("LOST -> Red accent, light red bg, red left border, badge: Lost", () => {
      const leadLost = { status: "Lost" };
      const theme = getLeadCardTheme(leadLost);

      expect(getLeadVisualState(leadLost)).toBe("LOST");
      expect(theme.accentColor).toBe("red");
      expect(theme.cardBg).toContain("bg-rose-50");
      expect(theme.leftBorder).toContain("border-l-rose-500");
      expect(theme.badgeLabel).toBe("Lost");
    });

    it("WASTE -> Neutral/White/Gray accent, gray border, badge: Waste", () => {
      const leadWaste = { status: "New", isWaste: true };
      const theme = getLeadCardTheme(leadWaste);

      expect(getLeadVisualState(leadWaste)).toBe("WASTE");
      expect(theme.accentColor).toBe("neutral");
      expect(theme.cardBg).toContain("bg-slate-50");
      expect(theme.leftBorder).toContain("border-l-slate-400");
      expect(theme.badgeLabel).toBe("Waste");
    });
  });

  describe("2. Color Precedence Rules", () => {
    it("LOST takes top precedence (#1) over follow-up dates and all other statuses", () => {
      const lead = { status: "Lost", nextFollowUpDate: today, quickStatus: "INTERESTED" };
      expect(getLeadVisualState(lead)).toBe("LOST");
      expect(getLeadCardTheme(lead).accentColor).toBe("red");
    });

    it("WASTE takes precedence (#2) over follow-ups and won", () => {
      const lead = { isWaste: true, nextFollowUpDate: today, status: "Won" };
      expect(getLeadVisualState(lead)).toBe("WASTE");
      expect(getLeadCardTheme(lead).accentColor).toBe("neutral");
    });

    it("WON takes precedence (#3) over follow-ups and pipeline stages", () => {
      const lead = { status: "Won", nextFollowUpDate: today, quickStatus: "INTERESTED" };
      expect(getLeadVisualState(lead)).toBe("WON");
      expect(getLeadCardTheme(lead).accentColor).toBe("emerald");
    });

    it("A NEW lead with a follow-up due today looks GREEN (FOLLOW_UP_NOW)", () => {
      const lead = { status: "New", nextFollowUpDate: today };
      expect(getLeadVisualState(lead)).toBe("FOLLOW_UP_NOW");
      expect(getLeadCardTheme(lead).accentColor).toBe("green");
    });

    it("A Qualified lead with a future follow-up looks YELLOW (FUTURE_FOLLOW_UP)", () => {
      const lead = { status: "Qualified", nextFollowUpDate: futureDate };
      expect(getLeadVisualState(lead)).toBe("FUTURE_FOLLOW_UP");
      expect(getLeadCardTheme(lead).accentColor).toBe("yellow");
    });

    it("PROPOSAL_SENT takes precedence (#6) over Qualified, Contacted, and New", () => {
      const lead = { status: "Proposal Sent", quickStatus: "INTERESTED" };
      expect(getLeadVisualState(lead)).toBe("PROPOSAL_SENT");
      expect(getLeadCardTheme(lead).accentColor).toBe("indigo");
    });

    it("INTERESTED / QUALIFIED takes precedence (#7) over Call Not Pick, Call Again, and Contacted", () => {
      const lead = { status: "Qualified", quickStatus: "CALL_AGAIN" };
      expect(getLeadVisualState(lead)).toBe("INTERESTED");
      expect(getLeadCardTheme(lead).accentColor).toBe("purple");
    });

    it("CALL_NOT_PICK takes precedence (#8) over Call Again and Contacted", () => {
      const lead = { status: "Contacted", quickStatus: "CALL_NOT_PICK" };
      expect(getLeadVisualState(lead)).toBe("CALL_NOT_PICK");
      expect(getLeadCardTheme(lead).accentColor).toBe("pink");
    });

    it("CALL_AGAIN takes precedence (#9) over Contacted", () => {
      const lead = { status: "Contacted", quickStatus: "CALL_AGAIN" };
      expect(getLeadVisualState(lead)).toBe("CALL_AGAIN");
      expect(getLeadCardTheme(lead).accentColor).toBe("violet");
    });

    it("CONTACTED takes precedence (#10) over New", () => {
      const lead = { status: "Contacted", quickStatus: "NONE" };
      expect(getLeadVisualState(lead)).toBe("CONTACTED");
      expect(getLeadCardTheme(lead).accentColor).toBe("lavender");
    });
  });

  describe("3. All 11 Theme Configurations Defined", () => {
    const states = [
      "NEW",
      "FOLLOW_UP_NOW",
      "FUTURE_FOLLOW_UP",
      "INTERESTED",
      "CONTACTED",
      "CALL_NOT_PICK",
      "CALL_AGAIN",
      "PROPOSAL_SENT",
      "WON",
      "LOST",
      "WASTE",
    ] as const;

    states.forEach((st) => {
      it(`theme for ${st} has required cardBg, leftBorder, badgeClass, and badgeLabel`, () => {
        const t = LEAD_THEMES[st];
        expect(t).toBeDefined();
        expect(t.cardBg).toBeTruthy();
        expect(t.leftBorder).toContain("border-l-4");
        expect(t.badgeClass).toBeTruthy();
        expect(t.badgeLabel).toBeTruthy();
      });
    });
  });
});
