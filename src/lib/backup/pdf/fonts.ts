import fs from "node:fs";
import path from "node:path";
import * as fontkitModule from "fontkit";
import { BACKUP_FALLBACK_WARNING } from "../constants";

/**
 * ==============================================================================
 * EMBEDDED UNICODE FONT HANDLING
 * ==============================================================================
 *
 * Reports embed Noto Sans (Regular + Bold, SIL OFL) so that:
 *   • the Indian Rupee sign (U+20B9) renders as a real glyph,
 *   • text stays searchable/selectable (pdfkit writes a ToUnicode CMap),
 *   • any character is drawn instead of showing an empty box.
 *
 * Coverage is derived from the font's own cmap. Characters outside coverage (e.g. Devanagari,
 * which needs complex text shaping) are transliterated to their closest Latin form or replaced,
 * and the substitution is disclosed in the manifest — never rendered as a broken glyph. The raw
 * CSV/JSON files always carry the original text untouched.
 */

const FONT_FILES = {
  regular: "NotoSans-Regular.ttf",
  bold: "NotoSans-Bold.ttf",
} as const;

interface FontkitFont {
  characterSet?: number[];
  glyphForCodePoint(codePoint: number): { id: number } | null;
}

interface FontkitLike {
  create(data: Buffer): FontkitFont;
}

/**
 * `fontkit` ships as CommonJS; depending on the bundler the default export may be nested.
 * Resolve it defensively so glyph-coverage inspection works in every runtime.
 */
function resolveFontkit(): FontkitLike | null {
  const candidate =
    (fontkitModule as unknown as { default?: FontkitLike }).default ??
    (fontkitModule as unknown as FontkitLike);
  return typeof candidate?.create === "function" ? candidate : null;
}

/**
 * Curated safety net used only if the font's cmap cannot be inspected. It mirrors the Latin /
 * punctuation / currency coverage of Noto Sans, so ₹ still renders and unsupported scripts are
 * still transliterated rather than drawn as empty boxes.
 */
const FALLBACK_COVERAGE_RANGES: Array<[number, number]> = [
  [0x20, 0x7e],
  [0xa0, 0x24f],
  [0x2010, 0x2027],
  [0x2030, 0x205e],
  [0x2070, 0x209f],
  [0x20a0, 0x20bf],
  [0x20b9, 0x20b9],
  [0x2116, 0x2116],
  [0x2122, 0x2122],
  [0x2190, 0x2199],
];

function buildFallbackCoverage(): Set<number> {
  const set = new Set<number>();
  for (const [start, end] of FALLBACK_COVERAGE_RANGES) {
    for (let code = start; code <= end; code += 1) set.add(code);
  }
  return set;
}

export interface LoadedFonts {
  regular: Buffer | null;
  bold: Buffer | null;
  /** True when the embedded Unicode fonts were found. */
  embedded: boolean;
  /** Set of Unicode code points the regular face can draw. */
  coverage: Set<number> | null;
  warnings: string[];
}

let cached: LoadedFonts | null = null;

function candidatePaths(fileName: string): string[] {
  const paths = new Set<string>();
  try {
    paths.add(path.join(process.cwd(), "assets", "fonts", fileName));
  } catch {
    /* ignore */
  }
  // Fallback locations for bundled/standalone deployments.
  paths.add(path.join(process.cwd(), ".next", "standalone", "assets", "fonts", fileName));
  paths.add(path.join("/var/task", "assets", "fonts", fileName));
  return [...paths];
}

function readFont(fileName: string): Buffer | null {
  for (const candidate of candidatePaths(fileName)) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate);
      }
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

function buildCoverage(buffer: Buffer | null): Set<number> | null {
  if (!buffer) return null;
  try {
    const fontkit = resolveFontkit();
    if (!fontkit) return null;
    const font = fontkit.create(buffer);
    const characterSet = font.characterSet;
    if (!Array.isArray(characterSet) || characterSet.length === 0) return null;
    if (typeof font.glyphForCodePoint !== "function") return null;

    // A code point can be present in the cmap yet still resolve to glyph 0 (.notdef), which is
    // exactly what renders as a broken box. Only code points with a real outline are "covered".
    const drawable = new Set<number>();
    for (const codePoint of characterSet) {
      const glyph = font.glyphForCodePoint(codePoint);
      if (glyph && glyph.id !== 0) {
        drawable.add(codePoint);
      }
    }
    return drawable.size > 0 ? drawable : null;
  } catch {
    return null;
  }
}

export function loadBackupFonts(): LoadedFonts {
  if (cached) return cached;

  const warnings: string[] = [];
  const regular = readFont(FONT_FILES.regular);
  const bold = readFont(FONT_FILES.bold) ?? regular;

  if (!regular) {
    warnings.push(
      "The embedded Unicode fonts were not found, so the reports were generated with the built-in Latin fonts. " +
        "Indian Rupee glyphs were transliterated. Place assets/fonts/NotoSans-Regular.ttf and NotoSans-Bold.ttf next to the app to restore full Unicode rendering."
    );
  }

  const inspectedCoverage = buildCoverage(regular);
  if (regular && !inspectedCoverage) {
    warnings.push(
      "Glyph coverage could not be inspected from the embedded font, so a conservative Latin + currency character set was assumed when preparing report text."
    );
  }

  cached = {
    regular,
    bold,
    embedded: Boolean(regular),
    coverage: inspectedCoverage ?? buildFallbackCoverage(),
    warnings,
  };
  return cached;
}

/** Test/DI hook — clears the memoised font bundle. */
export function resetFontCache(): void {
  cached = null;
}

/* -------------------------------------------------------------------------- */
/*  Unicode sanitisation                                                       */
/* -------------------------------------------------------------------------- */

const ASCII_FALLBACKS: Record<string, string> = {
  "₹": "Rs. ",
  "₨": "Rs. ",
  "—": "-",
  "–": "-",
  "‒": "-",
  "…": "...",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "•": "-",
  "·": "-",
  "\u00a0": " ",
  "\u2028": " ",
  "\u2029": " ",
};

export interface SanitizedText {
  text: string;
  replacedCharacters: number;
}

/**
 * Normalises control characters and guarantees every remaining code point has a glyph in the
 * embedded font (or a documented ASCII fallback).
 */
export function sanitizePdfText(input: string | null | undefined): SanitizedText {
  if (input === null || input === undefined) return { text: "", replacedCharacters: 0 };

  const fonts = loadBackupFonts();
  const normalised = String(input).replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  let replacedCharacters = 0;
  let output = "";

  for (const character of normalised) {
    const codePoint = character.codePointAt(0) as number;

    if (codePoint < 0x20) {
      output += character === "\n" ? "\n" : " ";
      continue;
    }
    if (codePoint === 0x7f) {
      output += " ";
      continue;
    }

    if (!fonts.coverage || fonts.coverage.has(codePoint)) {
      output += character;
      continue;
    }

    // 1) Documented direct transliteration (₹ -> "Rs. ") keeps figures understandable.
    const direct = ASCII_FALLBACKS[character];
    if (direct) {
      output += direct;
      replacedCharacters += 1;
      continue;
    }

    // 2) Strip accents / compatibility decomposition to the closest Latin form.
    const decomposed = character.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    if (decomposed && composedIsCovered(decomposed, fonts.coverage)) {
      output += decomposed;
      replacedCharacters += 1;
      continue;
    }

    // 3) Last resort: a neutral placeholder (never a broken/blank glyph).
    output += "?";
    replacedCharacters += 1;
  }

  return { text: output, replacedCharacters };
}

function composedIsCovered(value: string, coverage: Set<number>): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) as number;
    if (codePoint < 0x20) continue;
    if (!coverage.has(codePoint)) return false;
  }
  return true;
}

export const FONT_WARNING = BACKUP_FALLBACK_WARNING;