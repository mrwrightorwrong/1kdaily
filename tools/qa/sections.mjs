/**
 * Section-level visual review: captures chosen elements at full size and
 * reports the computed font stack.
 *
 * Usage: node tools/qa/sections.mjs [baseUrl]
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3100";
const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const executablePath = BROWSERS.find((candidate) => existsSync(candidate));

const browser = await chromium.launch({ executablePath, args: ["--hide-scrollbars"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const fontInfo = await page.evaluate(async () => {
  await document.fonts.ready;
  const loaded = [...document.fonts].map((face) => `${face.family} ${face.weight} ${face.status}`);
  return {
    computed: getComputedStyle(document.body).fontFamily,
    interLoaded: document.fonts.check('16px "Inter"'),
    faces: loaded.slice(0, 6),
  };
});
console.log(JSON.stringify(fontInfo, null, 2));

for (const [name, selector] of [
  ["sec-eligibility", "#eligibility"],
  ["sec-plans", "#plans"],
  ["sec-security", "#security"],
  ["sec-faq", "#faq"],
]) {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await element.screenshot({ path: `.screens/${name}.png` });
}

await browser.close();
console.log("sections captured");
