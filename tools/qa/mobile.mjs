/**
 * Mobile viewport review: captures fixed-size frames at several scroll offsets
 * so long pages can be inspected at real scale rather than as a thumbnail.
 *
 * Usage: node tools/qa/mobile.mjs [path] [width]
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const path = process.argv[2] ?? "/";
const widthArg = process.argv.slice(3).find((argument) => /^\d+$/.test(argument));
const width = Number(widthArg ?? 390);
const BASE = "http://localhost:3100";
const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const executablePath = BROWSERS.find((candidate) => existsSync(candidate));

const browser = await chromium.launch({ executablePath, args: ["--hide-scrollbars"] });
const page = await browser.newPage({
  viewport: { width, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});

await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);

if (process.argv.includes("--drawer")) {
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: ".screens/m-drawer.png" });
  console.log("drawer captured");
  await browser.close();
  process.exit(0);
}

const height = await page.evaluate(() => document.documentElement.scrollHeight);
const frames = Math.min(8, Math.ceil(height / 844));

for (let index = 0; index < frames; index += 1) {
  await page.evaluate((y) => window.scrollTo(0, y), index * 844);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `.screens/m-${index}.png` });
}

console.log(`captured ${frames} frames (${height}px tall) at ${width}px`);
await browser.close();
