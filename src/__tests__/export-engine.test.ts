import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  exportLeads,
  exportDeals,
  exportPayments,
  exportOutstandingBalances,
  exportFollowUps,
  exportBusinessSummary,
  transformSummaryToRows,
  type LeadExportRow,
  type DealExportRow,
  type PaymentExportRow,
  type OutstandingBalanceExportRow,
  type FollowUpExportRow,
  type BusinessSummaryData,
} from "@/lib/export";

describe("CRM Export Engine Foundation", () => {
  // ─── 1. LEADS EXPORT ──────────────────────────────────────────────────────────
  describe("Leads Export", () => {
    const testLeads: LeadExportRow[] = [
      {
        name: "Aarav Sharma",
        business: "Sharma Textiles & Crafts",
        phone: "+91 9876543210",
        email: "aarav@sharmatextiles.com",
        industry: "Textiles",
        source: "Meta Ads",
        status: "Qualified",
        quotedAmount: 45000,
        nextFollowUp: "22 Sep 2026, 11:30 AM",
        lastActivity: "20 Sep 2026: Sent product quotation",
        isPinned: true,
        isStale: false,
        createdAt: "15 Sep 2026, 10:00 AM",
      },
      {
        name: "Priya Patel",
        business: "Patel Agro Solutions",
        phone: "+91 9123456789",
        email: "priya@patelagro.in",
        industry: "Agriculture",
        source: "Google Search",
        status: "Contacted",
        quotedAmount: 25000,
        nextFollowUp: "—",
        lastActivity: "12 Sep 2026: Called customer, no response",
        isPinned: false,
        isStale: true,
        createdAt: "10 Sep 2026, 02:15 PM",
      },
      {
        name: "Vikram Malhotra",
        business: "V.M. & Sons, Mumbai",
        phone: "+91 9988776655",
        email: "",
        industry: "Retail",
        source: "Referral",
        status: "New",
        quotedAmount: null,
        nextFollowUp: "20 Sep 2026, 04:00 PM",
        lastActivity: "20 Sep 2026: Lead created via inquiry",
        isPinned: false,
        isStale: false,
        createdAt: "20 Sep 2026, 09:30 AM",
      },
    ];

    it("exports leads to CSV with UTF-8 BOM, readable dates, and properly quoted fields", async () => {
      const result = await exportLeads(testLeads, "csv");
      expect(result.rowCount).toBe(3);
      expect(result.mimeType).toBe("text/csv; charset=utf-8");
      expect(result.filename).toMatch(/^scale-flow-leads-\d{4}-\d{2}-\d{2}\.csv$/);

      const content = result.buffer.toString("utf-8");
      // Must start with UTF-8 Byte Order Mark
      expect(content.charCodeAt(0)).toBe(0xfeff);

      // Verify column headers exist
      expect(content).toContain("Name,Business,Phone,Email,Industry,Source,Canonical Status,Quoted Amount (INR),Next Follow-up,Last Meaningful Activity,Pinned,Stale,Created Date");

      // Verify row values
      expect(content).toContain("Aarav Sharma");
      expect(content).toContain("Sharma Textiles & Crafts");
      expect(content).toContain("45000");
      expect(content).toContain("Yes"); // Pinned
      expect(content).toContain("Patel Agro Solutions");
      expect(content).toContain("Yes"); // Stale

      // Verify comma in business name is properly quoted
      expect(content).toContain('"V.M. & Sons, Mumbai"');
    });

    it("exports leads to Excel (.xlsx) with true numeric amounts and styled headers", async () => {
      const result = await exportLeads(testLeads, "xlsx");
      expect(result.rowCount).toBe(3);
      expect(result.filename).toMatch(/^scale-flow-leads-\d{4}-\d{2}-\d{2}\.xlsx$/);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.buffer as unknown as ArrayBuffer);
      const worksheet = workbook.getWorksheet("Leads");
      expect(worksheet).toBeDefined();

      // 1 Header row + 3 Data rows
      expect(worksheet!.rowCount).toBe(4);

      // Verify Header
      const headerRow = worksheet!.getRow(1);
      expect(headerRow.getCell(1).value).toBe("Name");
      expect(headerRow.getCell(8).value).toBe("Quoted Amount (INR)");

      // Verify Row 1: Quoted amount is a genuine JS number
      const row1 = worksheet!.getRow(2);
      expect(row1.getCell(1).value).toBe("Aarav Sharma");
      expect(row1.getCell(8).value).toBe(45000);
      expect(typeof row1.getCell(8).value).toBe("number");
      expect(row1.getCell(11).value).toBe("Yes"); // Pinned
      expect(row1.getCell(12).value).toBe("No"); // Stale

      // Verify Row 2: Stale is Yes
      const row2 = worksheet!.getRow(3);
      expect(row2.getCell(1).value).toBe("Priya Patel");
      expect(row2.getCell(12).value).toBe("Yes"); // Stale
    });

    it("does not leak internal secrets, password hashes, or sensitive tokens", async () => {
      const result = await exportLeads(testLeads, "csv");
      const content = result.buffer.toString("utf-8");

      expect(content).not.toContain("passwordHash");
      expect(content).not.toContain("password");
      expect(content).not.toContain("DATABASE_URL");
      expect(content).not.toContain("VAPID");
      expect(content).not.toContain("SESSION");
      expect(content).not.toContain("secret");
    });
  });

  // ─── 2. DEALS EXPORT ──────────────────────────────────────────────────────────
  describe("Deals Export", () => {
    const testDeals: DealExportRow[] = [
      {
        clientName: "Maxwell Corp",
        clientType: "CRM Client",
        company: "Maxwell Industries Ltd",
        projectName: "Enterprise E-Commerce Suite",
        finalAmount: 120000,
        currency: "INR",
        totalReceived: 80000,
        remainingBalance: 40000,
        paymentStatus: "Partially Paid",
        nextPaymentDueDate: "25 Sep 2026",
        nextPaymentDueAmount: 40000,
        dealStatus: "CONFIRMED",
        createdAt: "01 Sep 2026",
      },
      {
        clientName: "Nexus Digital",
        clientType: "Other Client",
        company: "Nexus Technologies",
        projectName: "Cloud Migration",
        finalAmount: 60000,
        currency: "INR",
        totalReceived: 60000,
        remainingBalance: 0,
        paymentStatus: "Paid",
        nextPaymentDueDate: "—",
        nextPaymentDueAmount: null,
        dealStatus: "COMPLETED",
        createdAt: "05 Sep 2026",
      },
      {
        clientName: "Legacy Client (Deleted)",
        clientType: "Lead Deleted",
        company: "Historic Retailers",
        projectName: "Brand Portal 2025",
        finalAmount: 35000,
        currency: "INR",
        totalReceived: 15000,
        remainingBalance: 20000,
        paymentStatus: "Overdue",
        nextPaymentDueDate: "10 Sep 2026",
        nextPaymentDueAmount: 20000,
        dealStatus: "CONFIRMED",
        createdAt: "15 Aug 2026",
      },
    ];

    it("correctly includes CRM Client, Other Client, and preserved deleted-lead deal", async () => {
      const result = await exportDeals(testDeals, "csv");
      expect(result.rowCount).toBe(3);

      const content = result.buffer.toString("utf-8");
      expect(content).toContain("CRM Client");
      expect(content).toContain("Other Client");
      expect(content).toContain("Lead Deleted");
      expect(content).toContain("Enterprise E-Commerce Suite");
      expect(content).toContain("Partially Paid");
      expect(content).toContain("Paid");
      expect(content).toContain("Overdue");
    });

    it("exports numeric financial values in Excel for deals", async () => {
      const result = await exportDeals(testDeals, "xlsx");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.buffer as unknown as ArrayBuffer);
      const worksheet = workbook.getWorksheet("Deals");

      // Check Row 1 (Maxwell Corp)
      const row1 = worksheet!.getRow(2);
      expect(row1.getCell(5).value).toBe(120000); // finalAmount
      expect(typeof row1.getCell(5).value).toBe("number");
      expect(row1.getCell(7).value).toBe(80000); // totalReceived
      expect(typeof row1.getCell(7).value).toBe("number");
      expect(row1.getCell(8).value).toBe(40000); // remainingBalance
      expect(typeof row1.getCell(8).value).toBe("number");
    });
  });

  // ─── 3. PAYMENTS EXPORT ───────────────────────────────────────────────────────
  describe("Payments Export", () => {
    const testPayments: PaymentExportRow[] = [
      {
        clientName: "Maxwell Corp",
        dealOrProject: "Enterprise E-Commerce Suite",
        amount: 40000,
        paymentDate: "05 Sep 2026",
        paymentType: "ADVANCE",
        paymentMethod: "BANK_TRANSFER",
        reference: "NEFT-987654321",
        note: "Initial 33% mobilization advance",
        createdAt: "05 Sep 2026, 11:30 AM",
      },
      {
        clientName: "Maxwell Corp",
        dealOrProject: "Enterprise E-Commerce Suite",
        amount: 40000,
        paymentDate: "15 Sep 2026",
        paymentType: "PARTIAL",
        paymentMethod: "UPI",
        reference: "UPI-432198765",
        note: "Milestone 1 design signoff payment",
        createdAt: "15 Sep 2026, 03:45 PM",
      },
      {
        clientName: "Nexus Digital",
        dealOrProject: "Cloud Migration",
        amount: 60000,
        paymentDate: "12 Sep 2026",
        paymentType: "FINAL",
        paymentMethod: "CARD",
        reference: "TXN-CC-5544",
        note: "Full settlement upon signoff",
        createdAt: "12 Sep 2026, 01:20 PM",
      },
    ];

    it("emits each payment as a separate row with reference IDs and methods", async () => {
      const result = await exportPayments(testPayments, "csv");
      expect(result.rowCount).toBe(3);

      const content = result.buffer.toString("utf-8");
      expect(content).toContain("NEFT-987654321");
      expect(content).toContain("UPI-432198765");
      expect(content).toContain("TXN-CC-5544");
      expect(content).toContain("BANK_TRANSFER");
      expect(content).toContain("UPI");
      expect(content).toContain("CARD");
    });

    it("preserves payment amounts as numbers in Excel", async () => {
      const result = await exportPayments(testPayments, "xlsx");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.buffer as unknown as ArrayBuffer);
      const worksheet = workbook.getWorksheet("Payments");

      const row1 = worksheet!.getRow(2);
      expect(row1.getCell(3).value).toBe(40000);
      expect(typeof row1.getCell(3).value).toBe("number");

      const row3 = worksheet!.getRow(4);
      expect(row3.getCell(3).value).toBe(60000);
      expect(typeof row3.getCell(3).value).toBe("number");
    });
  });

  // ─── 4. OUTSTANDING BALANCES EXPORT ───────────────────────────────────────────
  describe("Outstanding Balances Export", () => {
    const rawDeals: OutstandingBalanceExportRow[] = [
      {
        clientName: "Deal Fully Paid Ltd",
        business: "Fully Paid Business",
        dealValue: 50000,
        received: 50000,
        remaining: 0, // MUST BE EXCLUDED!
        paymentStatus: "Paid",
        nextDueDate: "—",
        nextDueAmount: null,
        daysOverdue: 0,
      },
      {
        clientName: "Partially Paid Co",
        business: "Growth Inc",
        dealValue: 70000,
        received: 35000,
        remaining: 35000, // MUST BE INCLUDED
        paymentStatus: "Partially Paid",
        nextDueDate: "30 Sep 2026",
        nextDueAmount: 35000,
        daysOverdue: 0,
      },
      {
        clientName: "Overdue Client Pvt Ltd",
        business: "Overdue Enterprises",
        dealValue: 90000,
        received: 20000,
        remaining: 70000, // MUST BE INCLUDED
        paymentStatus: "Overdue",
        nextDueDate: "10 Sep 2026",
        nextDueAmount: 70000,
        daysOverdue: 10,
      },
    ];

    it("strictly filters only deals with Remaining > 0, excluding fully paid deals", async () => {
      const result = await exportOutstandingBalances(rawDeals, "csv");
      // Only 2 of the 3 deals should remain!
      expect(result.rowCount).toBe(2);

      const content = result.buffer.toString("utf-8");
      expect(content).not.toContain("Deal Fully Paid Ltd");
      expect(content).toContain("Partially Paid Co");
      expect(content).toContain("Overdue Client Pvt Ltd");
      expect(content).toContain("10"); // Days overdue
    });

    it("exports remaining balances and days overdue as numeric values in Excel", async () => {
      const result = await exportOutstandingBalances(rawDeals, "xlsx");
      expect(result.rowCount).toBe(2);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.buffer as unknown as ArrayBuffer);
      const worksheet = workbook.getWorksheet("Outstanding Balances");

      // Row count: 1 Header + 2 data rows
      expect(worksheet!.rowCount).toBe(3);

      const row1 = worksheet!.getRow(2);
      expect(row1.getCell(1).value).toBe("Partially Paid Co");
      expect(row1.getCell(5).value).toBe(35000); // Remaining
      expect(typeof row1.getCell(5).value).toBe("number");

      const row2 = worksheet!.getRow(3);
      expect(row2.getCell(1).value).toBe("Overdue Client Pvt Ltd");
      expect(row2.getCell(5).value).toBe(70000); // Remaining
      expect(row2.getCell(9).value).toBe(10); // Days Overdue
      expect(typeof row2.getCell(9).value).toBe("number");
    });
  });

  // ─── 5. FOLLOW-UPS EXPORT ─────────────────────────────────────────────────────
  describe("Follow-ups Export", () => {
    const testFollowUps: FollowUpExportRow[] = [
      {
        leadName: "Rahul Sen",
        phone: "+91 9876500001",
        status: "Contacted",
        followUpDate: "20 Sep 2026",
        followUpTime: "11:00 AM",
        followUpType: "Call",
        followUpNote: "Call to confirm proposal review",
        timingState: "Today",
      },
      {
        leadName: "Ananya Roy",
        phone: "+91 9876500002",
        status: "Qualified",
        followUpDate: "23 Sep 2026",
        followUpTime: "03:00 PM",
        followUpType: "WhatsApp",
        followUpNote: "Send revised commercial terms",
        timingState: "Upcoming",
      },
      {
        leadName: "Sunil Verma",
        phone: "+91 9876500003",
        status: "Proposal Sent",
        followUpDate: "18 Sep 2026",
        followUpTime: "10:00 AM",
        followUpType: "Email",
        followUpNote: "Overdue contract signing reminder",
        timingState: "Overdue",
      },
    ];

    it("includes Today, Upcoming, and Overdue states with clean column headers", async () => {
      const result = await exportFollowUps(testFollowUps, "csv");
      expect(result.rowCount).toBe(3);

      const content = result.buffer.toString("utf-8");
      expect(content).toContain("Today");
      expect(content).toContain("Upcoming");
      expect(content).toContain("Overdue");
      expect(content).toContain("Rahul Sen");
      expect(content).toContain("Call");
      expect(content).toContain("WhatsApp");
      expect(content).toContain("Email");
    });

    it("loads cleanly into Excel with all columns populated", async () => {
      const result = await exportFollowUps(testFollowUps, "xlsx");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.buffer as unknown as ArrayBuffer);
      const worksheet = workbook.getWorksheet("Follow-ups");

      expect(worksheet!.rowCount).toBe(4);
      const headerRow = worksheet!.getRow(1);
      expect(headerRow.getCell(1).value).toBe("Lead Name");
      expect(headerRow.getCell(8).value).toBe("Timing State");

      const rowToday = worksheet!.getRow(2);
      expect(rowToday.getCell(8).value).toBe("Today");
    });
  });

  // ─── 6. BUSINESS SUMMARY REPORT ───────────────────────────────────────────────
  describe("Business Summary Report", () => {
    const summaryData: BusinessSummaryData = {
      period: "all_time",
      periodLabel: "All Time",
      totalLeads: 120,
      qualifiedLeads: 35,
      wonDeals: 8,
      totalDealValue: 240000,
      paymentsReceived: 170000,
      outstanding: 70000,
      overdue: 25000,
      followUpsDue: 12,
      staleLeads: 9,
    };

    it("transforms business summary into rows matching canonical numbers", () => {
      const rows = transformSummaryToRows(summaryData);
      expect(rows.length).toBe(9);

      const map = new Map(rows.map((r) => [r.metric, r.value]));
      expect(map.get("Total Leads")).toBe(120);
      expect(map.get("Qualified Leads")).toBe(35);
      expect(map.get("Won Deals")).toBe(8);
      expect(map.get("Total Deal Value")).toBe(240000);
      expect(map.get("Payments Received")).toBe(170000);
      expect(map.get("Outstanding Balance")).toBe(70000);
      expect(map.get("Overdue Balance")).toBe(25000);
      expect(map.get("Follow-ups Due")).toBe(12);
      expect(map.get("Stale Leads")).toBe(9);
    });

    it("exports business summary to CSV and Excel with Unicode ₹ support", async () => {
      const csvResult = await exportBusinessSummary(summaryData, "csv");
      expect(csvResult.rowCount).toBe(9);
      const csvContent = csvResult.buffer.toString("utf-8");

      expect(csvContent).toContain("Total Deal Value");
      expect(csvContent).toContain("240000");
      expect(csvContent).toContain("Payments Received");
      expect(csvContent).toContain("170000");
      expect(csvContent).toContain("₹");

      const xlsxResult = await exportBusinessSummary(summaryData, "xlsx");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(xlsxResult.buffer as unknown as ArrayBuffer);
      const worksheet = workbook.getWorksheet("Business Summary");

      expect(worksheet!.rowCount).toBe(10); // 1 header + 9 rows
      const totalValRow = worksheet!.getRow(5); // Total Deal Value
      expect(totalValRow.getCell(2).value).toBe(240000);
      expect(typeof totalValRow.getCell(2).value).toBe("number");
    });
  });
});
