const fs = require("fs");
const { inflateSync } = require("zlib");

const buffer = fs.readFileSync("scratch-builder-out.pdf");
const out = [];

function parseObjects(buffer) {
  const raw = buffer.toString("latin1");
  const objects = new Map();
  const pattern = /(\d+)\s+0\s+obj\b/g;
  let match = pattern.exec(raw);
  while (match) {
    const number = Number(match[1]);
    const bodyStart = match.index + match[0].length;
    const endIndex = raw.indexOf("endobj", bodyStart);
    const body = raw.slice(bodyStart, endIndex < 0 ? raw.length : endIndex);
    const streamIndex = body.indexOf("stream");
    let dict = body;
    let inflated = null;
    if (streamIndex >= 0) {
      dict = body.slice(0, streamIndex);
      let dataStart = bodyStart + streamIndex + 6;
      if (buffer[dataStart] === 0x0d) dataStart += 1;
      if (buffer[dataStart] === 0x0a) dataStart += 1;
      let dataEnd = raw.indexOf("endstream", dataStart);
      if (dataEnd < 0) dataEnd = buffer.length;
      if (buffer[dataEnd - 1] === 0x0a) dataEnd -= 1;
      if (buffer[dataEnd - 1] === 0x0d) dataEnd -= 1;
      try {
        inflated = inflateSync(buffer.subarray(dataStart, dataEnd)).toString("latin1");
      } catch {
        inflated = buffer.subarray(dataStart, dataEnd).toString("latin1");
      }
    }
    objects.set(number, { number, dict, inflated });
    pattern.lastIndex = endIndex < 0 ? raw.length : endIndex;
    match = pattern.exec(raw);
  }
  return objects;
}

function decodeUtf16BeHex(hex) {
  const normalised = hex.length % 4 === 0 ? hex : hex.padStart(hex.length + (4 - (hex.length % 4)), "0");
  let result = "";
  for (let i = 0; i + 4 <= normalised.length; i += 4) {
    result += String.fromCharCode(parseInt(normalised.slice(i, i + 4), 16));
  }
  return result;
}

function parseCMap(stream) {
  const map = new Map();
  const charBlocks = stream.match(/beginbfchar([\s\S]*?)endbfchar/gi) || [];
  for (const block of charBlocks) {
    const pairs = block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || [];
    for (const pair of pairs) {
      const parsed = pair.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/);
      map.set(parseInt(parsed[1], 16), decodeUtf16BeHex(parsed[2]));
    }
  }
  const rangeBlocks = stream.match(/beginbfrange([\s\S]*?)endbfrange/gi) || [];
  for (const block of rangeBlocks) {
    const rows = block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/g) || [];
    for (const row of rows) {
      const parsed = row.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/);
      const low = parseInt(parsed[1], 16);
      const high = parseInt(parsed[2], 16);
      const target = parsed[3];
      if (target.startsWith("[")) {
        const items = target.match(/<([0-9A-Fa-f]+)>/g) || [];
        items.forEach((item, index) => map.set(low + index, decodeUtf16BeHex(item.replace(/[<>]/g, ""))));
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

const objects = parseObjects(buffer);
out.push("=== OBJECTS ===");
for (const object of objects.values()) {
  const dictPreview = object.dict.replace(/\s+/g, " ").slice(0, 200);
  out.push(`OBJ ${object.number}: ${dictPreview}${object.inflated ? " || STREAM " + JSON.stringify(object.inflated.replace(/\s+/g, " ").slice(0, 160)) : ""}`);
}

const fontCmaps = new Map();
out.push("=== FONT RESOURCE PARSING ===");
for (const object of objects.values()) {
  const fontDictMatch = object.dict.match(/\/Font\s*<<([\s\S]*?)>>/);
  if (!fontDictMatch) continue;
  out.push(`resource object ${object.number}: ${JSON.stringify(fontDictMatch[1].replace(/\s+/g, " "))}`);
  const entries = fontDictMatch[1].match(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/g) || [];
  for (const entry of entries) {
    const parsed = entry.match(/\/([A-Za-z0-9]+)\s+(\d+)\s+0\s+R/);
    const name = parsed[1];
    const fontObject = objects.get(Number(parsed[2]));
    const toUnicodeMatch = fontObject && fontObject.dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    out.push(`  name=${name} fontObj=${parsed[2]} toUnicode=${toUnicodeMatch ? toUnicodeMatch[1] : "MISSING"}`);
    if (toUnicodeMatch) {
      const cmap = parseCMap(objects.get(Number(toUnicodeMatch[1])).inflated);
      fontCmaps.set(name, cmap);
      out.push(`  cmap size=${cmap.size} sample=${JSON.stringify([...cmap.entries()].slice(0, 8).map(([k, v]) => k + ":" + v))}`);
    }
  }
}

out.push("=== TOKEN WALK (first 40) ===");
let tokens = 0;
for (const object of objects.values()) {
  const content = object.inflated;
  if (!content || !/\bTj\b|\bTJ\b/.test(content)) continue;
  const fallback = new Map();
  for (const cmap of fontCmaps.values()) for (const [k, v] of cmap) if (!fallback.has(k)) fallback.set(k, v);
  let current = fallback;
  const token =
    /\/([A-Za-z0-9]+)\s+[\d.]+\s+Tf|\[((?:[^\]\\]|\\.)*)\]\s*TJ|<([0-9A-Fa-f\s]+)>\s*Tj|\(((?:[^()\\]|\\.)*)\)\s*Tj|\b(?:Td|TD|T\*|Tm)\b/g;
  let match = token.exec(content);
  let activeName = "fallback";
  while (match && tokens < 40) {
    if (match[1]) {
      activeName = match[1];
      current = fontCmaps.get(match[1]) || fallback;
      out.push(`FONT -> ${match[1]} (cmap size ${current.size})`);
    } else if (match[2] !== undefined) {
      const hexItems = match[2].match(/<([0-9A-Fa-f\s]+)>/g) || [];
      let decoded = "";
      for (const item of hexItems) {
        const hex = item.replace(/[<>\s]/g, "");
        for (let i = 0; i + 4 <= hex.length; i += 4) decoded += current.get(parseInt(hex.slice(i, i + 4), 16)) || "";
      }
      out.push(`TJ[${activeName}] ${JSON.stringify(decoded.slice(0, 90))}`);
      tokens += 1;
    } else if (match[3] !== undefined) {
      const hex = match[3].replace(/\s+/g, "");
      let decoded = "";
      for (let i = 0; i + 4 <= hex.length; i += 4) decoded += current.get(parseInt(hex.slice(i, i + 4), 16)) || "";
      out.push(`Tj[${activeName}] ${JSON.stringify(decoded.slice(0, 90))}`);
      tokens += 1;
    } else {
      tokens += 1;
    }
    match = token.exec(content);
  }
}

fs.writeFileSync("scratch-verify-debug.txt", out.join("\n"));
console.log("written", out.length, "lines");

const extra = [];
extra.push("=== FULL CMAP obj 21 (regular/F2) ===");
extra.push(objects.get(21).inflated);
extra.push("=== FULL CMAP obj 25 (bold/F3) ===");
extra.push(objects.get(25).inflated);

const content = objects.get(5).inflated;
const index = content.indexOf("Conh");
extra.push("=== RAW AROUND Confidential ===");
extra.push(JSON.stringify(content.slice(Math.max(0, index - 400), index + 200)));

const sizes = content.match(/\/F\d \d+ Tf/g) || [];
extra.push("=== FONT SWITCHES ===" + JSON.stringify(sizes.slice(0, 40)));

fs.writeFileSync("scratch-verify-extra.txt", extra.join("\n"));
console.log("extra written");