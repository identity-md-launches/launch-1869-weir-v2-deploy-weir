// Capture the running preview at a given viewport. usage: node scripts/capture.mjs <url> <out.png> <width> <height> [fullPage]
import { chromium } from "@playwright/test";
const [url, out, w = "1536", h = "1024", full = "0"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: full === "1" });
await browser.close();
console.log("captured", out);
