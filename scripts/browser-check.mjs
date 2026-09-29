import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
mkdirSync(".tmp", { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const base = process.env.BOWLING_URL ?? "http://127.0.0.1:5174";
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  permissions: ["camera"],
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(base + "/?dev");
await page.waitForFunction(() => !!window.bowlingDev);
await page.waitForTimeout(1800);
await page.screenshot({ path: ".tmp/start-desktop.png" });
await page.locator("#start").click();
await page.waitForTimeout(9000);
await page.screenshot({ path: ".tmp/camera-desktop.png" });
const camera = await page.evaluate(() => ({
  status: document.querySelector("#status").textContent,
  error: document.querySelector("#start-error").textContent,
  videoWidth: document.querySelector("video").videoWidth,
}));
assert.equal(camera.videoWidth, 640);
assert.equal(camera.error, "");
await page.evaluate(() => window.bowlingDev.throw(8, 0.007));
await page.waitForTimeout(2500);
await page.screenshot({ path: ".tmp/throw-desktop.png" });
await page.waitForTimeout(6500);
await page.screenshot({ path: ".tmp/next-desktop.png" });
const score = await page.locator("#scorecard").innerText();
await page.waitForFunction(
  () =>
    !window.bowlingDev.physics.active &&
    document.querySelector("#result").hidden,
  {},
  { timeout: 20000 },
);
const standing = await page.evaluate(() =>
  window.bowlingDev.physics.pins.map((p) => p.id),
);
assert.ok(standing.length < 10 && standing.length > 0);
await page.screenshot({ path: ".tmp/ready-second-delivery.png" });
await page.evaluate(() => window.bowlingDev.throw(8, 0));
await page.waitForFunction(
  () =>
    !window.bowlingDev.physics.active &&
    document.querySelector("#result").hidden,
  {},
  { timeout: 25000 },
);
const nextFrame = await page.locator("#frame-label").innerText();
assert.match(nextFrame, /Frame 2/);
assert.equal(
  await page.evaluate(() => window.bowlingDev.physics.pins.length),
  10,
);
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + "/");
await page.waitForTimeout(2000);
await page.screenshot({ path: ".tmp/start-mobile.png" });
writeFileSync(
  ".tmp/browser-report.json",
  JSON.stringify({ errors, camera, score }, null, 2),
);
console.log(JSON.stringify({ errors, camera, score }));
await browser.close();
assert.deepEqual(errors, []);
