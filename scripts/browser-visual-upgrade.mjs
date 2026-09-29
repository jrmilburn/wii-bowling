import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  permissions: ["camera"],
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:5174/?dev");
await page.waitForFunction(() => !!window.bowlingDev);
await page.waitForTimeout(1200);
await page.screenshot({ path: ".tmp/upgraded-intro.png" });
await page.evaluate(() => window.bowlingDev.view.setPlaying(true));
await page.waitForTimeout(2200);
await page.evaluate(() => {
  window.cameraAudit = [];
  const record = (t) => {
    const dev = window.bowlingDev;
    if (dev.physics.active)
      window.cameraAudit.push({
        t,
        position: dev.view.camera.position.toArray(),
        phase: dev.view.shotPhase,
      });
    window.cameraAuditRaf = requestAnimationFrame(record);
  };
  window.cameraAuditRaf = requestAnimationFrame(record);
});
await page.evaluate(() => window.bowlingDev.throw(8, 0.007));
for (const phase of [
  "release",
  "follow",
  "impact",
  "replay",
  "reaction",
  "aim",
]) {
  await page.waitForFunction(
    (phase) => document.body.dataset.shot === phase,
    phase,
    { timeout: 30000 },
  );
  if (phase === "reaction") await page.waitForTimeout(350);
  if (phase === "follow" || phase === "impact") {
    assert.equal(
      await page.evaluate(() => window.bowlingDev.view.ball.material.opacity),
      1,
      "Character camera fade must never fade the delivered ball",
    );
  }
  await page.screenshot({ path: `.tmp/upgraded-${phase}.png` });
}
assert.equal(await page.locator("#result").isHidden(), true);
const audit = await page.evaluate(() => {
  cancelAnimationFrame(window.cameraAuditRaf);
  return window.cameraAudit;
});
assert.ok(audit.length > 20);
assert.ok(
  audit.every((f) => !["replay", "reaction"].includes(f.phase)),
  "No cutscene during a live delivery",
);
const maxSpeed = Math.max(
  ...audit
    .slice(1)
    .map(
      (f, i) =>
        Math.hypot(...f.position.map((x, j) => x - audit[i].position[j])) /
        ((f.t - audit[i].t) / 1000),
    ),
);
assert.ok(
  maxSpeed < 12,
  `Camera movement must be continuous; got ${maxSpeed} m/s`,
);
assert.ok(
  audit.every((f) => Math.abs(f.position[0] - 0.1) < 0.01),
  "Camera must stay on its original aiming axis",
);
assert.ok(
  await page.evaluate(() => window.bowlingDev.physics.pins.length < 10),
);
await page.evaluate(() => window.bowlingDev.throw(8, 0));
await page.waitForFunction(
  () => document.body.dataset.shot === "aim",
  {},
  { timeout: 30000 },
);
assert.match(await page.locator("#frame-label").innerText(), /Frame 2/);
assert.equal(
  await page.evaluate(() => window.bowlingDev.physics.pins.length),
  10,
);
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:5174/");
await page.waitForTimeout(1200);
await page.screenshot({ path: ".tmp/upgraded-mobile.png" });
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://127.0.0.1:5176/vision.html");
await page.locator("#connect").click();
await page.waitForFunction(
  () => document.querySelector("video").videoWidth > 0,
);
await page.waitForFunction(
  () => document.querySelector("#empty-state").hidden,
  { timeout: 30000 },
);
await page.waitForTimeout(2000);
await page.screenshot({ path: ".tmp/vision-live.png" });
await page.locator("#show-video").uncheck();
assert.equal(await page.locator("video").evaluate((v) => v.style.opacity), "0");
await page.locator("#rotate").uncheck();
await page.locator("#fullscreen").click();
assert.ok(await page.evaluate(() => document.fullscreenElement));
await page.locator("#fullscreen").click();
writeFileSync(
  ".tmp/visual-upgrade-report.json",
  JSON.stringify(
    { errors, maxCameraSpeed: maxSpeed, cameraSamples: audit.length },
    null,
    2,
  ),
);
await browser.close();
assert.deepEqual(errors, []);
console.log(
  "Continuous delivery camera, post-delivery replay/reaction, next delivery, mobile and separate vision server passed.",
);
