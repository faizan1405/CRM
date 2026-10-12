/**
 * Minimal ambient types for `fontkit` (the package ships untyped browser/ESM entry points).
 * Only the surface used by the complete-backup PDF layer is declared.
 */
declare module "fontkit" {
  export interface FontkitGlyph {
    id: number;
    codePoints?: number[];
    advanceWidth?: number;
  }

  export interface FontkitFont {
    familyName?: string;
    subfamilyName?: string;
    numGlyphs?: number;
    /** Every Unicode code point present in the font's character map. */
    characterSet?: number[];
    glyphForCodePoint(codePoint: number): FontkitGlyph | null;
    hasGlyphForCodePoint?(codePoint: number): boolean;
  }

  export function create(data: Buffer | Uint8Array): FontkitFont;
  export function openSync(path: string): FontkitFont;
  export function open(path: string, callback: (error: Error | null, font?: FontkitFont) => void): void;

  const fontkit: {
    create: typeof create;
    openSync: typeof openSync;
    open: typeof open;
  };

  export default fontkit;
}