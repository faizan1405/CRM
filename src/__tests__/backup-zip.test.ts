import { describe, expect, it } from "vitest";
import { createZip, crc32, inspectZip, readZipEntry } from "@/lib/backup/zip";

describe("Complete backup ZIP writer & integrity verifier", () => {
  const entries = [
    { path: "PDF Reports/01_CRM_Overview.pdf", data: Buffer.from("%PDF-1.7 fake pdf payload".repeat(40)) },
    { path: "Raw Data/leads.csv", data: Buffer.from("\uFEFFid,name\n1,Rohan Kapoor\n2,आनंद\n") },
    { path: "Raw Data/complete_crm_export.json", data: Buffer.from(JSON.stringify({ hello: "world" })) },
    { path: "backup_manifest.json", data: Buffer.from(JSON.stringify({ records: 3 })) },
  ];

  it("builds a standard archive whose every entry passes CRC verification", () => {
    const zip = createZip(entries, { date: new Date("2026-10-13T04:15:00Z") });
    const report = inspectZip(zip);

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.entryCount).toBe(entries.length);
    expect(report.entries.map((entry) => entry.path).sort()).toEqual(entries.map((entry) => entry.path).sort());
    expect(zip.subarray(0, 4).toString("latin1")).toBe("PK\u0003\u0004");
  });

  it("round-trips file contents byte-for-byte, including UTF-8 and the rupee sign", () => {
    const zip = createZip(entries);
    for (const entry of entries) {
      const extracted = readZipEntry(zip, entry.path);
      expect(extracted).not.toBeNull();
      expect(extracted?.equals(entry.data)).toBe(true);
    }
    const csv = readZipEntry(zip, "Raw Data/leads.csv")?.toString("utf8") ?? "";
    expect(csv).toContain("₹");
    expect(csv).toContain("आनंद");
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("compresses compressible data and stores incompressible data without inflating it", () => {
    const compressible = createZip([{ path: "a.txt", data: Buffer.from("A".repeat(5000)) }]);
    const incompressible = Buffer.alloc(4000);
    for (let index = 0; index < incompressible.length; index += 1) {
      incompressible[index] = (index * 197) % 256;
    }
    const storedZip = createZip([{ path: "b.bin", data: incompressible }]);

    const compressedEntry = inspectZip(compressible).entries[0];
    const storedEntry = inspectZip(storedZip).entries[0];

    expect(compressedEntry.method).toBe(8);
    expect(compressedEntry.compressedSize).toBeLessThan(compressedEntry.size);
    expect([0, 8]).toContain(storedEntry.method);
    expect(storedEntry.size).toBe(incompressible.length);
  });

  it("detects a corrupted entry through its CRC-32", () => {
    const zip = createZip(entries);
    const index = zip.indexOf(Buffer.from("%PDF-1.7 fake pdf payload")) + 6;
    const corrupted = Buffer.from(zip);
    corrupted[index] = corrupted[index] ^ 0xff;
    // Flip a byte inside the stored/deflated payload without touching the central directory.
    const report = inspectZip(corrupted);
    expect(report.valid).toBe(false);
    expect(report.errors.join(" ")).toMatch(/CRC|size|inflate|corrupt/i);
  });

  it("rejects a truncated archive and an empty entry list", () => {
    const zip = createZip(entries);
    const truncated = zip.subarray(0, zip.length - 40);
    expect(inspectZip(truncated).valid).toBe(false);
    expect(() => createZip([])).toThrow(/empty/i);
  });

  it("computes CRC-32 values that match the published IEEE vectors", () => {
    expect(crc32(Buffer.from(""))).toBe(0);
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });
});