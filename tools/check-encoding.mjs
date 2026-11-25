/**
 * Source hygiene check: reports UTF-8 BOMs and the common mojibake patterns
 * produced by round-tripping UTF-8 through a legacy ANSI code page.
 *
 * Usage: node tools/check-encoding.mjs [root] [--fix]
 *   --fix  strips a BOM when the file is otherwise clean
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const root = args.find((argument) => !argument.startsWith("--")) ?? ".";

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".screens", ".vercel"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".css", ".md", ".svg", ".txt"]);

// UTF-8 sequences misread as Windows-1252 produce the patterns below.
const MOJIBAKE = ["\u00e2\u20ac", "\u00e2\u201a", "\u00c3\u00a9", "\u00c3\u00b3", "\u00c3\u00bc"];

async function* walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".gitignore") {
      if (SKIP_DIRS.has(entry.name)) continue;
    }
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

let problems = 0;
for await (const file of walk(root)) {
  const buffer = await readFile(file);
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const text = buffer.toString("utf8");
  const mojibake = MOJIBAKE.some((pattern) => text.includes(pattern));

  if (!hasBom && !mojibake) continue;
  problems += 1;
  const label = mojibake ? "MOJIBAKE" : "BOM     ";
  console.log(`${label} ${path.relative(root, file)}`);
  if (fix && hasBom && !mojibake) {
    await writeFile(file, buffer.subarray(3));
    console.log(`         ↳ BOM removed`);
  }
}

console.log(problems === 0 ? "encoding: clean" : `encoding: ${problems} file(s) need attention`);
process.exitCode = problems === 0 ? 0 : 1;
