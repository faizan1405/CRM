import PDFDocument from "pdfkit";
import {
  COLORS,
  CONTENT_BOTTOM,
  CONTENT_LEFT,
  CONTENT_TOP,
  CONTENT_WIDTH,
  FONT_NAMES,
  PAGE,
  SECTION_GAP,
  TEXT_SIZES,
} from "./theme";
import { loadBackupFonts, sanitizePdfText } from "./fonts";
import type { ReportKey } from "../types";

/* -------------------------------------------------------------------------- */
/*  Public option types                                                        */
/* -------------------------------------------------------------------------- */

export type ToneKind = "neutral" | "positive" | "warning" | "critical" | "info";

export interface ReportColumn {
  header: string;
  /** Fraction of the usable width (values are normalised, so 2/1/1 is as valid as .5/.25/.25). */
  width: number;
  align?: "left" | "right" | "center";
  /** Maximum wrapped lines per cell before an ellipsis is applied (default 3). */
  maxLines?: number;
  bold?: boolean;
  /** Absolute font size override in points. */
  fontSize?: number;
}

export interface ReportTable {
  caption?: string;
  columns: ReportColumn[];
  rows: string[][];
  emptyMessage?: string;
  totals?: string[];
  /** Optional per-row emphasis (for example the currently open stage). */
  emphasizeRows?: number[];
}

export interface KpiCard {
  label: string;
  value: string;
  hint?: string;
  tone?: ToneKind;
}

export interface ReportMeta {
  reportKey: ReportKey;
  fileName: string;
  title: string;
  subtitle: string;
  generatedAtIst: string;
  generatedAtUtc: string;
  generatedBy: string;
  organization: string;
  recordSummary: Array<{ label: string; value: string }>;
  scopeNote: string;
  warnings: string[];
}

export interface TableRenderStats {
  rowsRendered: number;
  truncatedCells: number;
  pagesUsed: number;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const TONE_MAP: Record<ToneKind, { accent: string; background: string; text: string }> = {
  neutral: { accent: COLORS.navy, background: COLORS.slate50, text: COLORS.slate900 },
  info: { accent: COLORS.blue, background: COLORS.blueSoft, text: COLORS.blue },
  positive: { accent: COLORS.emerald, background: COLORS.emeraldSoft, text: COLORS.emerald },
  warning: { accent: COLORS.amber, background: COLORS.amberSoft, text: COLORS.amber },
  critical: { accent: COLORS.rose, background: COLORS.roseSoft, text: COLORS.rose },
};

const PADDING_X = 5;
const PADDING_Y = 4.5;
const LINE_GAP = 1.5;

/* -------------------------------------------------------------------------- */
/*  Builder                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A restrained, print-ready management-report layout on top of PDFKit:
 * navy cover, KPI cards, section headings, wrapped multi-line data tables with
 * alternating rows and repeated headers, running headers, footers and page numbers.
 *
 * Every string passes through `sanitizePdfText` so an unsupported code point can never be
 * rendered as a broken character, and tables never clip text — rows grow and flow to the
 * next page instead.
 */
export class ReportBuilder {
  readonly doc: PDFKit.PDFDocument;
  readonly meta: ReportMeta;

  private y: number = CONTENT_TOP;
  private pageNumber = 0;
  private readonly contentPages: number[] = [];
  private truncatedCells = 0;
  private readonly chunks: Buffer[] = [];
  private readonly finished: Promise<Buffer>;
  private pageCount = 0;
  private finalized = false;
  private readonly fontWarnings: string[];

  constructor(meta: ReportMeta) {
    this.meta = meta;

    const fonts = loadBackupFonts();
    this.fontWarnings = fonts.warnings;

    this.doc = new PDFDocument({
      size: "A4",
      margins: {
        top: PAGE.marginTop,
        left: PAGE.marginLeft,
        right: PAGE.marginRight,
        bottom: PAGE.marginBottom,
      },
      bufferPages: true,
      autoFirstPage: false,
      compress: true,
      info: {
        Title: `${meta.title} — Scale Flow CRM`,
        Author: "Scale Flow CRM",
        Subject: `${meta.subtitle}. Complete CRM backup report generated ${meta.generatedAtIst} IST.`,
        Creator: "Scale Flow CRM — Complete Backup",
        Keywords: `Scale Flow, CRM, backup, ${meta.reportKey}, PDF report`,
      },
    });

    if (fonts.embedded && fonts.regular && fonts.bold) {
      this.doc.registerFont(FONT_NAMES.regular, fonts.regular);
      this.doc.registerFont(FONT_NAMES.bold, fonts.bold);
    }
    this.doc.font(this.bodyFont());

    const stream = this.doc as unknown as NodeJS.ReadableStream;
    this.finished = new Promise<Buffer>((resolve, reject) => {
      stream.on("data", (chunk: Buffer | string) => {
        this.chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      });
      stream.on("end", () => resolve(Buffer.concat(this.chunks)));
      stream.on("error", (error: Error) => reject(error));
    });

    this.addCoverPage();
  }

  /* ------------------------------ primitives ------------------------------ */

  private bodyFont(): string {
    return loadBackupFonts().embedded ? FONT_NAMES.regular : "Helvetica";
  }

  private headingFont(): string {
    return loadBackupFonts().embedded ? FONT_NAMES.bold : "Helvetica-Bold";
  }

  private resolve(text: string): string {
    return sanitizePdfText(text).text;
  }

  private measure(text: string, font: string, size: number): number {
    // PDFKit's `widthOfString(text, options)` ignores font/size in the options bag and measures with
    // the document's *current* font state, so the state is switched explicitly and restored.
    const internal = this.doc as unknown as { _font?: { name?: string }; _fontSize?: number };
    const previousName = internal._font?.name;
    const previousSize = internal._fontSize;
    try {
      this.doc.font(font, size);
      return this.doc.widthOfString(text);
    } catch {
      return text.length * size * 0.5;
    } finally {
      try {
        if (previousName) {
          this.doc.font(previousName, previousSize ?? TEXT_SIZES.body);
        } else {
          this.doc.font(this.bodyFont(), TEXT_SIZES.body);
        }
      } catch {
        this.doc.font(this.bodyFont(), TEXT_SIZES.body);
      }
    }
  }

  private wrap(
    text: string,
    maxWidth: number,
    font: string,
    size: number,
    maxLines?: number
  ): { lines: string[]; truncated: boolean } {
    const paragraphs = this.resolve(text).split("\n");
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.replace(/\s+$/g, "");
      if (trimmed === "") {
        lines.push("");
        continue;
      }
      const words = trimmed.split(/\s+/);
      let current = "";

      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (this.measure(candidate, font, size) <= maxWidth) {
          current = candidate;
          continue;
        }
        if (current) {
          lines.push(current);
          current = "";
        }
        if (this.measure(word, font, size) <= maxWidth) {
          current = word;
          continue;
        }
        // Hard-break a single oversized word so it can never overflow the cell.
        let fragment = "";
        for (const character of word) {
          const next = fragment + character;
          if (this.measure(next, font, size) > maxWidth && fragment) {
            lines.push(fragment);
            fragment = character;
          } else {
            fragment = next;
          }
        }
        current = fragment;
      }
      if (current) lines.push(current);
    }

    if (lines.length === 0) lines.push("");

    const limit = maxLines && maxLines > 0 ? maxLines : undefined;
    if (limit && lines.length > limit) {
      const clipped = lines.slice(0, limit);
      clipped[limit - 1] = `${clipped[limit - 1].replace(/\s+$/, "")} …`;
      return { lines: clipped, truncated: true };
    }

    return { lines, truncated: false };
  }

  private ensureSpace(height: number): void {
    if (this.y + height > CONTENT_BOTTOM) {
      this.addContentPage();
    }
  }

  private get pageIndex(): number {
    return this.pageNumber - 1;
  }

  /* --------------------------------- pages -------------------------------- */

  private addCoverPage(): void {
    this.doc.addPage();
    this.pageNumber += 1;

    const bandHeight = 268;
    this.doc.rect(0, 0, PAGE.width, bandHeight).fill(COLORS.navy);
    this.doc.rect(0, bandHeight, PAGE.width, 4).fill(COLORS.accent);
    this.doc.rect(0, bandHeight + 4, PAGE.width, 2).fill(COLORS.blue);

    const left = CONTENT_LEFT;

    this.doc.fillColor(COLORS.accent).fontSize(TEXT_SIZES.coverSub).font(this.headingFont());
    this.doc.text(this.resolve(this.meta.organization.toUpperCase()), left, 58, {
      characterSpacing: 1.6,
      lineBreak: false,
    });

    this.doc
      .fillColor(COLORS.white)
      .font(this.headingFont())
      .fontSize(TEXT_SIZES.cover)
      .text(this.resolve(this.meta.title), left, 92, { width: CONTENT_WIDTH - 20 });

    this.doc
      .fillColor(COLORS.slate200)
      .font(this.bodyFont())
      .fontSize(TEXT_SIZES.coverSub)
      .text(this.resolve(this.meta.subtitle), left, this.doc.y + 10, { width: CONTENT_WIDTH - 40 });

    const metaItems: Array<[string, string]> = [
      ["Report generated (IST)", this.meta.generatedAtIst],
      ["Prepared by", this.meta.generatedBy],
      ["Data scope", this.meta.scopeNote],
      ["Report file", this.meta.fileName],
    ];
    let metaY = 196;
    for (const [label, value] of metaItems) {
      this.doc
        .fillColor(COLORS.slate400)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.small)
        .text(this.resolve(label.toUpperCase()), left, metaY, { width: 170, characterSpacing: 0.6 });
      this.doc
        .fillColor(COLORS.white)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.body)
        .text(this.resolve(value), left + 178, metaY - 1, { width: CONTENT_WIDTH - 178 });
      metaY += 17;
    }

    this.y = bandHeight + 34;
    this.heading("Records included in this backup", undefined, { compact: true });

    const summary = this.meta.recordSummary;
    if (summary.length > 0) {
      const columns = 3;
      const gap = 8;
      const tileWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
      const tileHeight = 30;
      summary.forEach((item, index) => {
        const columnIndex = index % columns;
        if (columnIndex === 0) {
          this.ensureSpace(tileHeight + 4);
        }
        const x = CONTENT_LEFT + columnIndex * (tileWidth + gap);
        const y = this.y;
        this.doc.roundedRect(x, y, tileWidth, tileHeight, 4).fillAndStroke(COLORS.slate50, COLORS.slate200);
        this.doc
          .fillColor(COLORS.slate500)
          .font(this.bodyFont())
          .fontSize(TEXT_SIZES.kpiLabel)
          .text(this.resolve(item.label), x + 8, y + 6, {
            width: tileWidth - 16,
            lineBreak: false,
            ellipsis: true,
          });
        this.doc
          .fillColor(COLORS.slate900)
          .font(this.headingFont())
          .fontSize(11)
          .text(this.resolve(item.value), x + 8, y + 16, {
            width: tileWidth - 16,
            lineBreak: false,
            ellipsis: true,
          });
        if (columnIndex === columns - 1 || index === summary.length - 1) {
          this.y += tileHeight + gap;
        }
      });
    }

    const warningLines = [...this.meta.warnings, ...this.fontWarnings];
    if (warningLines.length > 0) {
      this.ensureSpace(40);
      this.addCallout("Data notes", warningLines, "warning");
    }

    this.y = Math.max(this.y, 520);
    this.doc
      .fillColor(COLORS.slate500)
      .font(this.bodyFont())
      .fontSize(TEXT_SIZES.small)
      .text(
        this.resolve(
          "Confidential. This document contains the complete business data of the CRM workspace and is intended for authorised management use only. Figures are a read-only snapshot and the export never modifies production records."
        ),
        CONTENT_LEFT,
        this.y,
        { width: CONTENT_WIDTH, align: "left" }
      );
  }

  private addContentPage(): void {
    this.doc.addPage();
    this.pageNumber += 1;
    this.contentPages.push(this.pageIndex);

    const topRuleY = PAGE.marginTop - 22;
    this.doc
      .moveTo(CONTENT_LEFT, topRuleY)
      .lineTo(CONTENT_LEFT + CONTENT_WIDTH, topRuleY)
      .lineWidth(0.6)
      .strokeColor(COLORS.slate200)
      .stroke();

    this.doc
      .fillColor(COLORS.navy)
      .font(this.headingFont())
      .fontSize(TEXT_SIZES.small)
      .text(this.resolve(this.meta.title.toUpperCase()), CONTENT_LEFT, topRuleY + 6, {
        width: CONTENT_WIDTH / 2,
        characterSpacing: 0.8,
        lineBreak: false,
      });

    this.doc
      .fillColor(COLORS.slate400)
      .font(this.bodyFont())
      .fontSize(TEXT_SIZES.small)
      .text(this.resolve(this.meta.fileName), CONTENT_LEFT + CONTENT_WIDTH / 2, topRuleY + 6, {
        width: CONTENT_WIDTH / 2,
        align: "right",
        lineBreak: false,
      });

    this.y = CONTENT_TOP + 10;
  }

  private drawFooters(totalPages: number): void {
    const range = this.doc.bufferedPageRange();

    for (let i = range.start; i < range.start + range.count; i += 1) {
      this.doc.switchToPage(i);
      const isCover = i === range.start;
      const previousBottomMargin = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0;

      const footerY = PAGE.height - 40;
      this.doc
        .moveTo(CONTENT_LEFT, footerY - 8)
        .lineTo(CONTENT_LEFT + CONTENT_WIDTH, footerY - 8)
        .lineWidth(0.6)
        .strokeColor(isCover ? COLORS.navyMid : COLORS.slate200)
        .stroke();

      const label = isCover
        ? "Scale Flow CRM · Complete Backup — Confidential"
        : `Scale Flow CRM · ${this.meta.title}`;
      this.doc
        .fillColor(isCover ? COLORS.slate400 : COLORS.slate500)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.small)
        .text(this.resolve(label), CONTENT_LEFT, footerY, {
          width: CONTENT_WIDTH * 0.55,
          lineBreak: false,
        });

      this.doc
        .fillColor(COLORS.slate500)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.small)
        .text(
          this.resolve(`Page ${i - range.start + 1} of ${totalPages} · ${this.meta.generatedAtIst} IST`),
          CONTENT_LEFT + CONTENT_WIDTH * 0.55,
          footerY,
          { width: CONTENT_WIDTH * 0.45, align: "right", lineBreak: false }
        );

      this.doc.page.margins.bottom = previousBottomMargin;
    }
  }

  /* ------------------------------- content -------------------------------- */

  heading(title: string, description?: string, options: { compact?: boolean } = {}): void {
    this.ensureSpace(TEXT_SIZES.section + 12 + (description ? 22 : 6));

    const startY = this.y;
    this.doc.rect(CONTENT_LEFT, startY + 2, 3.5, 14).fill(COLORS.blue);
    this.doc
      .fillColor(COLORS.navy)
      .font(this.headingFont())
      .fontSize(TEXT_SIZES.section)
      .text(this.resolve(title), CONTENT_LEFT + 10, startY, { width: CONTENT_WIDTH - 10 });

    let cursor = this.doc.y + 3;
    if (description) {
      this.doc
        .fillColor(COLORS.slate500)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.small)
        .text(this.resolve(description), CONTENT_LEFT + 10, cursor, { width: CONTENT_WIDTH - 10 });
      cursor = this.doc.y + 3;
    }

    this.doc
      .moveTo(CONTENT_LEFT, cursor)
      .lineTo(CONTENT_LEFT + CONTENT_WIDTH, cursor)
      .lineWidth(0.6)
      .strokeColor(COLORS.slate200)
      .stroke();

    this.y = cursor + (options.compact ? 8 : 11);
  }

  subHeading(title: string): void {
    this.ensureSpace(24);
    this.doc
      .fillColor(COLORS.navyMid)
      .font(this.headingFont())
      .fontSize(TEXT_SIZES.subSection)
      .text(this.resolve(title), CONTENT_LEFT, this.y, { width: CONTENT_WIDTH });
    this.y = this.doc.y + 6;
  }

  paragraph(text: string): void {
    const { lines } = this.wrap(text, CONTENT_WIDTH, this.bodyFont(), TEXT_SIZES.body);
    this.ensureSpace(lines.length * (TEXT_SIZES.body + LINE_GAP) + 6);
    this.doc
      .fillColor(COLORS.slate700)
      .font(this.bodyFont())
      .fontSize(TEXT_SIZES.body)
      .text(this.resolve(text), CONTENT_LEFT, this.y, { width: CONTENT_WIDTH, lineGap: LINE_GAP });
    this.y = this.doc.y + 8;
  }

  bullets(items: string[]): void {
    const size = TEXT_SIZES.body;
    for (const item of items) {
      const { lines } = this.wrap(item, CONTENT_WIDTH - 14, this.bodyFont(), size);
      this.ensureSpace(lines.length * (size + LINE_GAP) + 5);
      const startY = this.y;
      this.doc.circle(CONTENT_LEFT + 3, startY + size / 2 + 1.5, 1.6).fill(COLORS.blue);
      this.doc
        .fillColor(COLORS.slate700)
        .font(this.bodyFont())
        .fontSize(size)
        .text(this.resolve(item), CONTENT_LEFT + 14, startY, { width: CONTENT_WIDTH - 14, lineGap: LINE_GAP });
      this.y = this.doc.y + 3;
    }
    this.y += 4;
  }

  spacer(height = SECTION_GAP): void {
    this.y += height;
  }

  kpiCards(cards: KpiCard[], columns = 3): void {
    if (cards.length === 0) return;
    const gap = 9;
    const cardWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
    const cardHeight = 52;

    for (let index = 0; index < cards.length; index += 1) {
      const columnIndex = index % columns;
      if (columnIndex === 0) {
        this.ensureSpace(cardHeight + gap);
      }
      const card = cards[index];
      const tone = TONE_MAP[card.tone ?? "neutral"];
      const x = CONTENT_LEFT + columnIndex * (cardWidth + gap);
      const y = this.y;

      this.doc.roundedRect(x, y, cardWidth, cardHeight, 5).fillAndStroke(tone.background, COLORS.slate200);
      this.doc.rect(x, y, 3, cardHeight).fill(tone.accent);

      const innerWidth = cardWidth - 20;
      this.doc
        .fillColor(COLORS.slate500)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.kpiLabel)
        .text(this.resolve(card.label.toUpperCase()), x + 11, y + 8, {
          width: innerWidth,
          characterSpacing: 0.5,
          lineBreak: false,
          ellipsis: true,
        });

      this.doc
        .fillColor(tone.text)
        .font(this.headingFont())
        .fontSize(this.valueFontSize(card.value, innerWidth))
        .text(this.resolve(card.value), x + 11, y + 19, {
          width: innerWidth,
          lineBreak: false,
          ellipsis: true,
        });

      if (card.hint) {
        this.doc
          .fillColor(COLORS.slate400)
          .font(this.bodyFont())
          .fontSize(TEXT_SIZES.small)
          .text(this.resolve(card.hint), x + 11, y + 38, {
            width: innerWidth,
            lineBreak: false,
            ellipsis: true,
          });
      }

      if (columnIndex === columns - 1 || index === cards.length - 1) {
        this.y += cardHeight + gap;
      }
    }
    this.y += 2;
  }

  private valueFontSize(value: string, maxWidth: number): number {
    const resolved = this.resolve(value);
    let size = TEXT_SIZES.kpiValue;
    while (size > 8 && this.measure(resolved, this.headingFont(), size) > maxWidth) {
      size -= 0.5;
    }
    return size;
  }

  keyValueRows(items: Array<{ label: string; value: string }>, columns = 2): void {
    const gap = 16;
    const columnWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
    const rowHeight = 17;

    for (let index = 0; index < items.length; index += 1) {
      const columnIndex = index % columns;
      if (columnIndex === 0) {
        this.ensureSpace(rowHeight + 2);
      }
      const item = items[index];
      const x = CONTENT_LEFT + columnIndex * (columnWidth + gap);
      const y = this.y;
      const labelText = this.resolve(item.label);
      const labelWidth = Math.min(
        columnWidth * 0.66,
        this.measure(labelText, this.bodyFont(), TEXT_SIZES.body) + 6
      );

      this.doc
        .fillColor(COLORS.slate500)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.body)
        .text(labelText, x, y, { width: labelWidth, lineBreak: false, ellipsis: true });
      this.doc
        .fillColor(COLORS.slate900)
        .font(this.headingFont())
        .fontSize(TEXT_SIZES.body)
        .text(this.resolve(item.value), x + labelWidth + 4, y, {
          width: columnWidth - labelWidth - 4,
          lineBreak: false,
          ellipsis: true,
        });

      if (columnIndex === columns - 1 || index === items.length - 1) {
        this.y += rowHeight;
      }
    }
    this.y += 4;
  }

  addCallout(title: string, lines: string[], tone: ToneKind = "info"): void {
    const palette = TONE_MAP[tone];
    const size = TEXT_SIZES.body;
    const wrapped = lines.map((line) => this.wrap(line, CONTENT_WIDTH - 26, this.bodyFont(), size));
    const contentHeight = wrapped.reduce((sum, entry) => sum + entry.lines.length * (size + LINE_GAP) + 2, 0);
    const boxHeight = contentHeight + (title ? 18 : 0) + 16;

    this.ensureSpace(boxHeight + 6);

    const x = CONTENT_LEFT;
    const y = this.y;
    this.doc.roundedRect(x, y, CONTENT_WIDTH, boxHeight, 4).fillAndStroke(palette.background, COLORS.slate200);
    this.doc.rect(x, y, 3, boxHeight).fill(palette.accent);

    let cursor = y + 8;
    if (title) {
      this.doc
        .fillColor(palette.text)
        .font(this.headingFont())
        .fontSize(size)
        .text(this.resolve(title), x + 12, cursor, { width: CONTENT_WIDTH - 24 });
      cursor = this.doc.y + 3;
    }

    for (const entry of wrapped) {
      this.doc
        .fillColor(COLORS.slate700)
        .font(this.bodyFont())
        .fontSize(size)
        .text(entry.lines.join("\n"), x + 12, cursor, { width: CONTENT_WIDTH - 24, lineGap: LINE_GAP });
      cursor = this.doc.y + 2;
    }

    this.y = y + boxHeight + 10;
  }

  /**
   * Draws a data table. Rows grow to fit wrapped content, the header repeats on every page,
   * and a row is never split across a page boundary — when it would not fit it moves to the
   * next page. Empty categories render a friendly empty state instead of a bare header.
   */
  table(table: ReportTable): TableRenderStats {
    const startPage = this.pageNumber;
    const widthTotal = table.columns.reduce((sum, column) => sum + column.width, 0) || 1;
    const widths = table.columns.map((column) => (column.width / widthTotal) * CONTENT_WIDTH);

    if (table.caption) {
      this.ensureSpace(16);
      this.doc
        .fillColor(COLORS.slate500)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.small)
        .text(this.resolve(table.caption), CONTENT_LEFT, this.y, { width: CONTENT_WIDTH });
      this.y = this.doc.y + 5;
    }

    if (table.rows.length === 0) {
      const boxHeight = 30;
      this.ensureSpace(boxHeight + 6);
      this.doc
        .roundedRect(CONTENT_LEFT, this.y, CONTENT_WIDTH, boxHeight, 4)
        .fillAndStroke(COLORS.slate50, COLORS.slate200);
      this.doc
        .fillColor(COLORS.slate500)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.body)
        .text(this.resolve(table.emptyMessage ?? "No records in this category."), CONTENT_LEFT + 10, this.y + 10, {
          width: CONTENT_WIDTH - 20,
          lineBreak: false,
        });
      this.y += boxHeight + 12;
      return { rowsRendered: 0, truncatedCells: 0, pagesUsed: this.pageNumber - startPage + 1 };
    }

    const drawHeader = (): void => {
      const size = TEXT_SIZES.tableHeader;
      const cellLines = table.columns.map((column, index) =>
        this.wrap(column.header, widths[index] - PADDING_X * 2, this.headingFont(), size)
      );
      const lineCount = Math.max(1, ...cellLines.map((entry) => entry.lines.length));
      const height = lineCount * (size + LINE_GAP) + PADDING_Y * 2;

      this.doc.rect(CONTENT_LEFT, this.y, CONTENT_WIDTH, height).fill(COLORS.navy);

      let x = CONTENT_LEFT;
      table.columns.forEach((column, index) => {
        const cellWidth = widths[index];
        const align = column.align ?? "left";
        const firstLineWidth = this.measure(cellLines[index].lines[0] ?? "", this.headingFont(), size);
        const offset =
          align === "right"
            ? cellWidth - PADDING_X - firstLineWidth
            : align === "center"
              ? (cellWidth - firstLineWidth) / 2
              : PADDING_X;

        this.doc
          .fillColor(COLORS.white)
          .font(this.headingFont())
          .fontSize(size)
          .text(cellLines[index].lines.join("\n"), x + Math.max(PADDING_X / 2, offset), this.y + PADDING_Y, {
            width: cellWidth - PADDING_X,
            align,
            lineGap: LINE_GAP,
          });
        x += cellWidth;
      });

      this.y += height;
    };

    let truncatedCells = 0;
    let rowsRendered = 0;
    drawHeader();

    table.rows.forEach((row, rowIndex) => {
      const emphasize = table.emphasizeRows?.includes(rowIndex) ?? false;
      const size = TEXT_SIZES.table;
      const cells = table.columns.map((column, index) => {
        const value = row[index] ?? "";
        const font = column.bold || emphasize ? this.headingFont() : this.bodyFont();
        const cellSize = column.fontSize ?? size;
        const wrapped = this.wrap(
          String(value),
          widths[index] - PADDING_X * 2,
          font,
          cellSize,
          column.maxLines ?? 3
        );
        if (wrapped.truncated) truncatedCells += 1;
        return { ...wrapped, font, size: cellSize };
      });

      const lineCount = Math.max(1, ...cells.map((cell) => cell.lines.length));
      const rowHeight = lineCount * (size + LINE_GAP) + PADDING_Y * 2;

      if (this.y + rowHeight > CONTENT_BOTTOM) {
        this.addContentPage();
        drawHeader();
      }

      if (emphasize) {
        this.doc.rect(CONTENT_LEFT, this.y, CONTENT_WIDTH, rowHeight).fill(COLORS.blueSoft);
      } else if (rowIndex % 2 === 1) {
        this.doc.rect(CONTENT_LEFT, this.y, CONTENT_WIDTH, rowHeight).fill(COLORS.slate50);
      }

      let x = CONTENT_LEFT;
      cells.forEach((cell, index) => {
        const column = table.columns[index];
        const cellWidth = widths[index];
        const align = column.align ?? "left";
        const firstLineWidth = this.measure(cell.lines[0] ?? "", cell.font, cell.size);
        const offset =
          align === "right"
            ? cellWidth - PADDING_X - firstLineWidth
            : align === "center"
              ? (cellWidth - firstLineWidth) / 2
              : PADDING_X;

        this.doc
          .fillColor(COLORS.slate700)
          .font(cell.font)
          .fontSize(cell.size)
          .text(cell.lines.join("\n"), x + Math.max(PADDING_X / 2, offset), this.y + PADDING_Y, {
            width: cellWidth - PADDING_X,
            align,
            lineGap: LINE_GAP,
          });

        x += cellWidth;
      });

      this.doc
        .moveTo(CONTENT_LEFT, this.y + rowHeight)
        .lineTo(CONTENT_LEFT + CONTENT_WIDTH, this.y + rowHeight)
        .lineWidth(0.4)
        .strokeColor(COLORS.slate200)
        .stroke();

      this.y += rowHeight;
      rowsRendered += 1;
    });

    this.doc
      .moveTo(CONTENT_LEFT, this.y)
      .lineTo(CONTENT_LEFT + CONTENT_WIDTH, this.y)
      .lineWidth(0.6)
      .strokeColor(COLORS.slate300)
      .stroke();

    if (table.totals) {
      const size = TEXT_SIZES.table;
      const cells = table.columns.map((column, index) => {
        const font = this.headingFont();
        const cellSize = column.fontSize ?? size;
        const wrapped = this.wrap(
          String(table.totals?.[index] ?? ""),
          widths[index] - PADDING_X * 2,
          font,
          cellSize,
          2
        );
        return { ...wrapped, font, size: cellSize };
      });
      const lineCount = Math.max(1, ...cells.map((cell) => cell.lines.length));
      const rowHeight = lineCount * (size + LINE_GAP) + PADDING_Y * 2 + 2;

      if (this.y + rowHeight > CONTENT_BOTTOM) {
        this.addContentPage();
        drawHeader();
      }

      this.doc.rect(CONTENT_LEFT, this.y, CONTENT_WIDTH, rowHeight).fill(COLORS.navyMid);

      let x = CONTENT_LEFT;
      cells.forEach((cell, index) => {
        const column = table.columns[index];
        const cellWidth = widths[index];
        const align = column.align ?? "left";
        const firstLineWidth = this.measure(cell.lines[0] ?? "", cell.font, cell.size);
        const offset =
          align === "right"
            ? cellWidth - PADDING_X - firstLineWidth
            : align === "center"
              ? (cellWidth - firstLineWidth) / 2
              : PADDING_X;

        this.doc
          .fillColor(COLORS.white)
          .font(cell.font)
          .fontSize(cell.size)
          .text(cell.lines.join("\n"), x + Math.max(PADDING_X / 2, offset), this.y + PADDING_Y + 1, {
            width: cellWidth - PADDING_X,
            align,
            lineGap: LINE_GAP,
          });
        x += cellWidth;
      });
      this.y += rowHeight;
    }

    this.y += 12;
    this.truncatedCells += truncatedCells;
    return { rowsRendered, truncatedCells, pagesUsed: this.pageNumber - startPage + 1 };
  }

  divider(): void {
    this.ensureSpace(14);
    this.doc
      .moveTo(CONTENT_LEFT, this.y)
      .lineTo(CONTENT_LEFT + CONTENT_WIDTH, this.y)
      .lineWidth(0.6)
      .strokeColor(COLORS.slate200)
      .stroke();
    this.y += 12;
  }

  /**
   * Horizontal bar list — used for funnels and categorical breakdowns. Bars are proportional to
   * the largest value in the list, and the exact figure is always printed next to the bar so the
   * graphic never replaces the number.
   */
  barList(
    items: Array<{ label: string; value: number; display: string }>,
    options: { maxItems?: number; tone?: ToneKind; emptyMessage?: string; labelWidth?: number } = {}
  ): void {
    if (items.length === 0) {
      this.addCallout("", [options.emptyMessage ?? "No data available for this breakdown."], "neutral");
      return;
    }

    const limited = options.maxItems ? items.slice(0, options.maxItems) : items;
    const palette = TONE_MAP[options.tone ?? "info"];
    const labelWidth = options.labelWidth ?? 150;
    const valueWidth = 92;
    const barStart = CONTENT_LEFT + labelWidth;
    const barWidth = CONTENT_WIDTH - labelWidth - valueWidth;
    const max = Math.max(...limited.map((item) => item.value), 1);
    const rowHeight = 16;

    for (const item of limited) {
      this.ensureSpace(rowHeight);
      const y = this.y;

      this.doc
        .fillColor(COLORS.slate700)
        .font(this.bodyFont())
        .fontSize(TEXT_SIZES.body)
        .text(this.resolve(item.label), CONTENT_LEFT, y + 2, {
          width: labelWidth - 8,
          lineBreak: false,
          ellipsis: true,
        });

      this.doc.rect(barStart, y + 4, barWidth, 7).fill(COLORS.slate100);
      const filled = Math.max(2, (Math.max(0, item.value) / max) * barWidth);
      this.doc.rect(barStart, y + 4, filled, 7).fill(palette.accent);

      this.doc
        .fillColor(COLORS.slate900)
        .font(this.headingFont())
        .fontSize(TEXT_SIZES.body)
        .text(this.resolve(item.display), barStart + barWidth + 6, y + 2, {
          width: valueWidth - 6,
          align: "right",
          lineBreak: false,
          ellipsis: true,
        });

      this.y += rowHeight;
    }
    this.y += 6;
  }

  /* -------------------------------- output -------------------------------- */

  get pages(): number {
    return this.pageCount || this.pageNumber;
  }

  truncationCount(): number {
    return this.truncatedCells;
  }

  get warnings(): string[] {
    return this.fontWarnings;
  }

  finalize(): Promise<Buffer> {
    if (this.finalized) {
      return this.finished;
    }
    this.finalized = true;
    const range = this.doc.bufferedPageRange();
    this.pageCount = range.count;
    this.drawFooters(range.count);
    this.doc.end();
    return this.finished;
  }
}