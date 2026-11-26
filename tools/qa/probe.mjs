/**
 * Visual QA probe.
 *
 * Renders the app in the locally installed Edge/Chrome (no browser download),
 * reports horizontal-overflow offenders, and writes screenshots to `.screens/`.
 *
 * Usage: node tools/qa/probe.mjs [baseUrl]
 */
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3100";

const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const executablePath = BROWSERS.find((candidate) => existsSync(candidate));
if (!executablePath) {
  console.error("No local Chromium found.");
  process.exit(1);
}

const TARGETS = [
  { name: "home", path: "/", width: 1440, height: 900 },
  { name: "home-mobile", path: "/", width: 390, height: 844 },
  { name: "sign-up", path: "/sign-up", width: 1440, height: 900 },
  { name: "sign-up-mobile", path: "/sign-up", width: 390, height: 844 },
  { name: "sign-in", path: "/sign-in", width: 1280, height: 900 },
  { name: "verify-email", path: "/verify-email", width: 1280, height: 900 },
  { name: "forgot-password", path: "/forgot-password", width: 1280, height: 900 },
  { name: "design", path: "/design", width: 1280, height: 900 },
  { name: "legal", path: "/legal/privacy", width: 900, height: 900 },
  { name: "404", path: "/does-not-exist", width: 1280, height: 800 },
];

await mkdir(".screens", { recursive: true });

const browser = await chromium.launch({ executablePath, args: ["--hide-scrollbars"] });
const results = [];

for (const target of TARGETS) {
  const context = await browser.newContext({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message.slice(0, 200)}`));

  const response = await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const probe = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [];
    for (const element of document.querySelectorAll("body *")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > viewportWidth + 1) {
        const style = getComputedStyle(element);
        if (style.position === "fixed" && style.overflow === "hidden") continue;
        offenders.push({
          tag: element.tagName.toLowerCase(),
          cls: String(element.className ?? "").slice(0, 90),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }
    return {
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders: offenders.slice(0, 8),
    };
  });

  await page.screenshot({
    path: `.screens/${target.name}.png`,
    fullPage: true,
    animations: "disabled",
  });

  results.push({ target: target.name, status: response?.status(), ...probe, errors });
  await context.close();
}

await browser.close();

for (const result of results) {
  const overflow = result.scrollWidth > result.viewportWidth;
  console.log(
    `${overflow ? "OVERFLOW" : "ok      "} ${result.target.padEnd(14)} ${result.status} ` +
      `vw=${result.viewportWidth} scroll=${result.scrollWidth}`,
  );
  if (overflow) {
    for (const offender of result.offenders) {
      console.log(`    <${offender.tag}> right=${offender.right} w=${offender.width} .${offender.cls}`);
    }
  }
  for (const error of result.errors) console.log(`    console: ${error}`);
}
