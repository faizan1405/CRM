import { describe, expect, it } from "vitest";
import { ReportBuilder } from "@/lib/backup/pdf/report-builder";
import { verifyPdf } from "@/lib/backup/pdf/verify";
import { sanitizePdfText, loadBackupFonts } from "@/lib/backup/pdf/fonts";

function baseMeta() {
  return {
    reportKey: "finance" as const,
    fileName: "03_Finance_Report.pdf",
    title: "Finance Report",
    subtitle: "Contracted value, collections and receivables",
    generatedAtIst: "13 Oct 2026, 09:45 am",
    generatedAtUtc: "2026-10-13T04:15:00.000Z",
    generatedBy: "Faizan Admin (admin@scaleflow.test)",
    organization: "Scale Flow CRM",
    recordSummary: [
      { label: "Leads", value: "1,204" },
      { label: "Projects & Deals", value: "318" },
      { label: "Payments", value: "742" },
    ],
    scopeNote: "All time · no date filter applied",
    warnings: [],
  };
}

describe("Complete backup PDF renderer", () => {
  it("embeds the branded Unicode font with rupee coverage", () => {
    const fonts = loadBackupFonts();
    expect(fonts.embedded).toBe(true);
    expect(fonts.coverage?.has(0x20b9)).toBe(true);
    expect(fonts.warnings).toHaveLength(0);
  });

  it("renders a multi-page report with KPI cards, wrapped cells and totals", async () => {
    const builder = new ReportBuilder(baseMeta());

    builder.heading("Financial summary", "Canonical totals across every eligible deal.");
    builder.kpiCards(
      [
        { label: "Contracted value", value: "₹58,90,000.00", hint: "318 deals", tone: "neutral" },
        { label: "Money received", value: "₹41,20,500.00", hint: "742 payments", tone: "positive" },
        { label: "Outstanding", value: "₹17,69,500.00", hint: "96 deals", tone: "warning" },
      ],
      3
    );
    builder.keyValueRows([
      { label: "Collection rate", value: "69.96%" },
      { label: "Overdue amount", value: "₹4,32,000.00" },
    ]);

    const longName =
      "Shri Ramakrishnan Venkateshwara Subramanian Industrial Works and Co-operative Manufacturing Enterprise Private Limited";
    const note =
      "Client confirmed the advance over a call on Monday.\nPhase two scope includes catalogues, payment gateway wiring and multilingual landing pages. " +
      "₹25,000 balance is expected after the demo on the 21st.";

    const rows = Array.from({ length: 120 }, (_unused, index) => [
      `${index + 1}`,
      longName,
      `Project ${index + 1} — ${index % 3 === 0 ? "Website + CRM integration" : "Marketing retainer"}`,
      `₹${(12500 + index * 137).toLocaleString("en-IN")}.00`,
      note,
      index % 4 === 0 ? "Overdue" : "Partially Paid",
    ]);

    builder.table({
      caption: "Deal ledger — every eligible deal (all time)",
      columns: [
        { header: "#", width: 0.5, align: "right", maxLines: 1 },
        { header: "Client", width: 2.4, maxLines: 3 },
        { header: "Project", width: 2.2, maxLines: 2 },
        { header: "Contracted", width: 1.1, align: "right", maxLines: 1 },
        { header: "Payment notes", width: 2.6, maxLines: 4 },
        { header: "Status", width: 0.9, maxLines: 1 },
      ],
      rows,
      totals: ["", "120 deals", "", "₹58,90,000.00", "", ""],
    });

    const buffer = await builder.finalize();
    const verification = verifyPdf(buffer);

    expect(verification.issues).toEqual([]);
    expect(verification.valid).toBe(true);
    expect(verification.hasToUnicode).toBe(true);
    expect(verification.pageCount).toBeGreaterThan(1);
    expect(builder.pages).toBe(verification.pageCount);

    // Searchable, selectable text with real glyph coverage.
    expect(verification.extractedText).toContain("₹");
    expect(verification.extractedText).toContain("Finance Report");
    expect(verification.extractedText).toContain("Ramakrishnan");
    expect(verification.extractedText).toContain("Page");
  });

  it("keeps empty categories readable and never emits a bare table", async () => {
    const builder = new ReportBuilder(baseMeta());
    builder.heading("Loss events");
    builder.table({
      columns: [
        { header: "Reason", width: 1 },
        { header: "Count", width: 1, align: "right" },
      ],
      rows: [],
      emptyMessage: "No loss events recorded.",
    });
    const buffer = await builder.finalize();
    const verification = verifyPdf(buffer);

    expect(verification.valid).toBe(true);
    expect(verification.extractedText).toContain("No loss events recorded.");
  });

  it("transliterates unsupported scripts instead of rendering broken glyphs", () => {
    const devanagari = sanitizePdfText("ग्राहक का नाम");
    expect(devanagari.replacedCharacters).toBeGreaterThan(0);
    expect(devanagari.text).not.toMatch(/[\u0900-\u097F]/);

    const currency = sanitizePdfText("Advance ₹25,000 received");
    expect(currency.text).toBe("Advance ₹25,000 received");
    expect(currency.replacedCharacters).toBe(0);

    const control = sanitizePdfText("Line one\u0000\u0007\r\nLine two\tTAB");
    expect(control.text).toBe("Line one  \nLine two    TAB");
  });

  it("grows a row instead of clipping an oversized single-token cell", async () => {
    const builder = new ReportBuilder(baseMeta());
    const giantToken = "A".repeat(1200);
    builder.table({
      columns: [
        { header: "Reference", width: 1 },
        { header: "Unaligned token", width: 3, maxLines: 60 },
      ],
      rows: [["UTR-9932", giantToken]],
    });
    const buffer = await builder.finalize();
    const verification = verifyPdf(buffer);

    expect(verification.valid).toBe(true);
    // The long token must have been broken across multiple lines rather than clipped away.
    expect(verification.extractedText.replace(/[^A]/g, "").length).toBeGreaterThanOrEqual(200);
  });
});