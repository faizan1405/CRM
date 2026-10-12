import { deflateRawSync, inflateRawSync } from "node:zlib";
import type { ZipEntryInfo, ZipEntryInput, ZipIntegrityReport } from "./types";

/**
 * ==============================================================================
 * MINIMAL, DEPENDENCY-FREE ZIP WRITER + VERIFIER
 * ==============================================================================
 *
 * Produces a standard "deflate" ZIP archive (the format every desktop tool, Excel,
 * and the browser's built-in unarchiver understand) using only Node's zlib.
 *
 * CRC-32 is computed for every entry, and `inspectZip` re-reads the finished archive —
 * inflating each entry and comparing its CRC and byte size against the central
 * directory — so a corrupt archive can never be handed to the user as a "successful"
 * backup.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f),
  };
}

const MAX_UINT32 = 0xffffffff;

export interface CreateZipOptions {
  /** Timestamp stamped on every entry (defaults to now). */
  date?: Date;
  /** Compression level passed to zlib (defaults to 9 - maximum). */
  level?: number;
}

/**
 * Builds a ZIP archive from in-memory entries.
 *
 * Entries whose deflated form is not smaller than the original are stored uncompressed,
 * which keeps already-compressed payloads (PDF) from growing.
 */
export function createZip(entries: ZipEntryInput[], options: CreateZipOptions = {}): Buffer {
  if (entries.length === 0) {
    throw new Error("Cannot create an empty backup archive.");
  }
  if (entries.length > 0xffff) {
    throw new Error("Backup archive exceeds the 65,535 entry limit of the ZIP format.");
  }

  const stamp = dosDateTime(options.date ?? new Date());
  const level = options.level ?? 9;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.path, "utf8");
    const uncompressed = entry.data;
    const deflated = deflateRawSync(uncompressed, { level });
    const useDeflate = deflated.length < uncompressed.length;
    const payload = useDeflate ? deflated : uncompressed;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(uncompressed);

    if (uncompressed.length > MAX_UINT32 || payload.length > MAX_UINT32) {
      throw new Error(`Backup entry "${entry.path}" exceeds the 4 GB limit of the ZIP format.`);
    }

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 names
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(stamp.time, 10);
    localHeader.writeUInt16LE(stamp.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    locals.push(localHeader, nameBuffer, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(stamp.time, 12);
    centralHeader.writeUInt16LE(stamp.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra
    centralHeader.writeUInt16LE(0, 32); // comment
    centralHeader.writeUInt16LE(0, 34); // disk
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42);
    centrals.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + payload.length;
  }

  const centralDirectory = Buffer.concat(centrals);

  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralDirectory, endOfCentralDirectory]);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minimumOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= minimumOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      return i;
    }
  }
  return -1;
}

/**
 * Fully re-reads an archive: parses the central directory, inflates every entry and
 * verifies CRC-32 + byte size. Returns the per-entry report used by the backup manifest
 * and by the integrity test-suite.
 */
export function inspectZip(buffer: Buffer): ZipIntegrityReport {
  const errors: string[] = [];
  const entries: ZipEntryInfo[] = [];

  try {
    const eocdOffset = findEndOfCentralDirectory(buffer);
    if (eocdOffset < 0) {
      return { valid: false, entryCount: 0, totalBytes: 0, entries, errors: ["End of central directory not found."] };
    }

    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    const centralSize = buffer.readUInt32LE(eocdOffset + 12);
    let cursor = buffer.readUInt32LE(eocdOffset + 16);
    const centralEnd = cursor + centralSize;

    if (centralEnd > buffer.length) {
      errors.push("Central directory extends beyond the end of the archive.");
    }

    for (let i = 0; i < entryCount; i += 1) {
      if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
        errors.push(`Central directory entry ${i} is corrupt.`);
        break;
      }

      const method = buffer.readUInt16LE(cursor + 10);
      const expectedCrc = buffer.readUInt32LE(cursor + 16);
      const compressedSize = buffer.readUInt32LE(cursor + 20);
      const size = buffer.readUInt32LE(cursor + 24);
      const nameLength = buffer.readUInt16LE(cursor + 28);
      const extraLength = buffer.readUInt16LE(cursor + 30);
      const commentLength = buffer.readUInt16LE(cursor + 32);
      const localOffset = buffer.readUInt32LE(cursor + 42);
      const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

      entries.push({ path: name, compressedSize, size, crc32: expectedCrc, method });

      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
        errors.push(`Local header for "${name}" is corrupt.`);
      } else {
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const data = buffer.subarray(dataStart, dataStart + compressedSize);

        let decoded: Buffer;
        if (method === 0) {
          decoded = Buffer.from(data);
        } else if (method === 8) {
          decoded = inflateRawSync(data);
        } else {
          errors.push(`Entry "${name}" uses unsupported compression method ${method}.`);
          cursor += 46 + nameLength + extraLength + commentLength;
          continue;
        }

        if (decoded.length !== size) {
          errors.push(`Entry "${name}" size mismatch (expected ${size} bytes, inflated ${decoded.length}).`);
        }
        if (crc32(decoded) !== expectedCrc) {
          errors.push(`Entry "${name}" failed CRC-32 verification.`);
        }
      }

      cursor += 46 + nameLength + extraLength + commentLength;
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to read the archive.");
  }

  return {
    valid: errors.length === 0 && entries.length > 0,
    entryCount: entries.length,
    totalBytes: buffer.length,
    entries,
    errors,
  };
}

/** Extracts a single entry (used by tests and by internal verification). */
export function readZipEntry(buffer: Buffer, path: string): Buffer | null {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) return null;

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  let cursor = buffer.readUInt32LE(eocdOffset + 16);
  const centralEnd = Math.min(cursor + centralSize, buffer.length);

  for (let i = 0; i < entryCount && cursor + 46 <= centralEnd; i += 1) {
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    if (name === path) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      return method === 0 ? Buffer.from(data) : inflateRawSync(data);
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return null;
}