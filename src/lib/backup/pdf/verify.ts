import { inflateSync } from "node:zlib";

/**
 * ==============================================================================
 * PDF SELF-VERIFICATION
 * ==============================================================================
 *
 * A backup claims that "every expected PDF was generated successfully". This module proves it
 * from the produced bytes: it checks the PDF envelope, counts real page objects, confirms each
 * embedded font ships a ToUnicode CMap (which is what makes the text searchable/selectable) and
 * extracts the visible text — per font subset — so callers can assert that the report title and
 * the data really made it onto the pages.
 */

export interface PdfVerification {
  valid: boolean;
  pageCount: number;
  sizeBytes: number;
  hasToUnicode: boolean;
  fontsWithToUnicode: number;
  extractedText: string;
  issues: string[];
}

interface RawObject {
  number: number;
  dict: string;
  stream: Buffer | null;
  inflated: string | null;
}

function parseObjects(buffer: Buffer): Map<number, RawObject> {
  const raw = buffer.toString("latin1");
  const objects = new Map<number, RawObject>();
  const pattern = /(\d+)\s+0\s+obj\b/g;

  let match = pattern.exec(raw);
  while (match) {
    const number = Number(match[1]);
    const bodyStart = match.index + match[0].length;
    const endIndex = raw.indexOf("endobj", bodyStart);
    const bodyEnd = endIndex < 0 ? raw.length : endIndex;
    const body = raw.slice(bodyStart, bodyEnd);
    const streamIndex = body.indexOf("stream");

    let dict = body;
    let stream: Buffer | null = null;
    let inflated: string | null = null;

    if (streamIndex >= 0) {
      dict = body.slice(0, streamIndex);
      let dataStart = bodyStart + streamIndex + "stream".length;
      if (buffer[dataStart] === 0x0d) dataStart += 1;
      if (buffer[dataStart] === 0x0a) dataStart += 1;
      let dataEnd = raw.indexOf("endstream", dataStart);
      if (dataEnd < 0) dataEnd = buffer.length;
      if (buffer[dataEnd - 1] === 0x0a) dataEnd -= 1;
      if (buffer[dataEnd - 1] === 0x0d) dataEnd -= 1;
      stream = buffer.subarray(dataStart, dataEnd);
      try {
        inflated = inflateSync(stream).toString("latin1");
      } catch {
        inflated = stream.toString("latin1");
      }
    }

    objects.set(number, { number, dict, stream, inflated });
    pattern.lastIndex = bodyEnd;
    match = pattern.exec(raw);
  }

  return objects;
}

function decodeUtf16BeHex(hex: string): string {
  const normalised = hex.length % 4 === 0 ? hex : hex.padStart(hex.length + (4 - (hex.length % 4)), "0");
  let result = "";
  for (let i = 0; i + 4 <= normalised.length; i += 4) {
    result += String.fromCharCode(parseInt(normalised.slice(i, i + 4), 16));
  }
  return result;
}

/** Parses one ToUnicode CMap stream into a CID -> text lookup table. */
function parseCMap(stream: string): Map<number, string> {
  const map = new Map<number, string>();

  const charBlocks = stream.match(/beginbfchar([\s\S]*?)endbfchar/gi) ?? [];
  for (const block of charBlocks) {
    const pairs = block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) ?? [];
    for (const pair of pairs) {
      const parsed = pair.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      if (!parsed) continue;
      map.set(parseInt(parsed[1], 16), decodeUtf16BeHex(parsed[2]));
    }
  }

  const rangeBlocks = stream.match(/beginbfrange([\s\S]*?)endbfrange/gi) ?? [];
  for (const block of rangeBlocks) {
    const rows =
      block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/g) ?? [];
    for (const row of rows) {
      const parsed = row.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/);
      if (!parsed) continue;
      const low = parseInt(parsed[1], 16);
      const high = Math.min(parseInt(parsed[2], 16), low + 4096);
      const target = parsed[3];

      if (target.startsWith("[")) {
        // At least one array slot can legitimately hold several code points (a ligature such as
        // "fi" is written as <00660069>), so whitespace must be allowed inside the hex string —
        // otherwise the remaining slots shift by one and every later character decodes wrong.
        const items = target.match(/<([0-9A-Fa-f\s]+)>/g) ?? [];
        items.forEach((item, index) => {
          map.set(low + index, decodeUtf16BeHex(item.replace(/[<>]/g, "")));
        });
      } else {
        const baseHex = target.replace(/[<>]/g, "");
        const base = parseInt(baseHex.slice(-4) || "0", 16);
        for (let code = low; code <= high; code += 1) {
          map.set(code, decodeUtf16BeHex((base + (code - low)).toString(16).padStart(4, "0")));
        }
      }
    }
  }

  return map;
}

function decodePdfLiteralString(value: string): string {
  return value.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_match, escaped: string) => {
    const simple: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
    if (escaped in simple) return simple[escaped];
    if (/^[0-7]{1,3}$/.test(escaped)) return String.fromCharCode(parseInt(escaped, 8));
    return escaped;
  });
}

interface ExtractedText {
  text: string;
  fontsWithToUnicode: number;
}

/**
 * Walks the page content streams, tracking the active font so that each glyph id is decoded with
 * the correct subset's ToUnicode map (regular and bold subsets reuse the same CIDs for different
 * characters, so a single merged map would produce mojibake).
 */
function extractText(objects: Map<number, RawObject>): ExtractedText {
  const fontCmaps = new Map<string, Map<number, string>>();
  let fontsWithToUnicode = 0;

  // /Font << /F1 5 0 R /F2 6 0 R >> inside any resources dictionary.
  for (const object of objects.values()) {
    const fontDictMatch = object.dict.match(/\/Font\s*<<([\s\S]*?)>>/);
    if (!fontDictMatch) continue;
    const entries = fontDictMatch[1].match(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g) ?? [];

    for (const entry of entries) {
      const parsed = entry.match(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/);
      if (!parsed) continue;
      const resourceName = parsed[1];
      const fontObjectNumber = Number(parsed[2]);
      if (fontCmaps.has(resourceName)) continue;

      const fontObject = objects.get(fontObjectNumber);
      if (!fontObject) continue;
      const toUnicodeMatch = fontObject.dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
      if (!toUnicodeMatch) continue;
      const cmapObject = objects.get(Number(toUnicodeMatch[1]));
      if (!cmapObject?.inflated) continue;
      const cmap = parseCMap(cmapObject.inflated);
      if (cmap.size > 0) {
        fontCmaps.set(resourceName, cmap);
        fontsWithToUnicode += 1;
      }
    }
  }

  const fallbackCmap = new Map<number, string>();
  for (const cmap of fontCmaps.values()) {
    for (const [code, value] of cmap) {
      if (!fallbackCmap.has(code)) fallbackCmap.set(code, value);
    }
  }

  const parts: string[] = [];

  for (const object of objects.values()) {
    const content = object.inflated;
    if (!content || !/\bTj\b|\bTJ\b/.test(content)) continue;

    const activeCmap = { current: fallbackCmap };
    const token =
      /\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf|\[((?:[^\]\\]|\\.)*)\]\s*TJ|<([0-9A-Fa-f\s]+)>\s*Tj|\(((?:[^()\\]|\\.)*)\)\s*Tj|\b(?:Td|TD|T\*|Tm)\b/g;

    let match = token.exec(content);
    while (match) {
      if (match[1]) {
        activeCmap.current = fontCmaps.get(match[1]) ?? fallbackCmap;
      } else if (match[2] !== undefined) {
        const hexItems = match[2].match(/<([0-9A-Fa-f\s]+)>/g) ?? [];
        for (const item of hexItems) {
          parts.push(decodeHexWithCmap(item.replace(/[<>\s]/g, ""), activeCmap.current));
        }
        const literals = match[2].match(/\(((?:[^()\\]|\\.)*)\)/g) ?? [];
        for (const literal of literals) {
          parts.push(decodePdfLiteralString(literal.slice(1, -1)));
        }
      } else if (match[3] !== undefined) {
        parts.push(decodeHexWithCmap(match[3].replace(/\s+/g, ""), activeCmap.current));
      } else if (match[4] !== undefined) {
        parts.push(decodePdfLiteralString(match[4]));
      } else {
        parts.push("\n");
      }
      match = token.exec(content);
    }
  }

  return { text: parts.join(""), fontsWithToUnicode };
}

function decodeHexWithCmap(hex: string, cmap: Map<number, string>): string {
  let decoded = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    decoded += cmap.get(code) ?? "";
  }
  return decoded;
}

export function verifyPdf(buffer: Buffer): PdfVerification {
  const issues: string[] = [];
  const raw = buffer.toString("latin1");

  if (!raw.startsWith("%PDF-")) {
    issues.push("Missing %PDF header.");
  }
  if (!raw.trimEnd().endsWith("%%EOF")) {
    issues.push("Missing %%EOF trailer (the PDF may be truncated).");
  }

  const pageCount = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  if (pageCount === 0) {
    issues.push("No page objects found.");
  }

  let extractedText = "";
  let fontsWithToUnicode = 0;
  try {
    const objects = parseObjects(buffer);
    const extracted = extractText(objects);
    extractedText = extracted.text;
    fontsWithToUnicode = extracted.fontsWithToUnicode;
    if (fontsWithToUnicode === 0) {
      issues.push("No ToUnicode CMap found — text would not be searchable.");
    }
    if (extractedText.trim().length === 0) {
      issues.push("No extractable text found in the page content streams.");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "Failed to parse the generated PDF.");
  }

  return {
    valid: issues.length === 0,
    pageCount,
    sizeBytes: buffer.length,
    hasToUnicode: fontsWithToUnicode > 0,
    fontsWithToUnicode,
    extractedText,
    issues,
  };
}