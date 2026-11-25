/**
 * Ad-hoc style inspection.
 *
 * Usage: node tools/qa/inspect.mjs <path> <selector> [width]
 * Prints computed styles and a short ancestor chain for the matched element.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const [path = "/", selector = "header", width = "1440"] = process.argv.slice(2);
const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const executablePath = BROWSERS.find((candidate) => existsSync(candidate));

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
await page.goto(`http://localhost:3100${path}`, { waitUntil: "networkidle" });

const info = await page.evaluate((target) => {
  const element = document.querySelector(target);
  if (!element) return { error: `no match for ${target}` };
  const style = getComputedStyle(element);
  return {
    className: element.className,
    backgroundColor: style.backgroundColor,
    backdropFilter: style.backdropFilter,
    position: style.position,
    zIndex: style.zIndex,
    matchedRules: [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules];
        } catch {
          return [];
        }
      })
      .filter((rule) => rule.cssText?.includes("bg-canvas"))
      .slice(0, 5)
      .map((rule) => rule.cssText.slice(0, 240)),
  };
}, selector);

console.log(JSON.stringify(info, null, 2));
await browser.close();
