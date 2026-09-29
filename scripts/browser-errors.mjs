import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const base = process.env.BOWLING_URL ?? "http://127.0.0.1:5174";
for (const [name, expected] of [
  ["NotAllowedError", "Camera permission denied"],
  ["NotFoundError", "No camera found"],
  ["NotReadableError", "Camera is busy"],
]) {
  const page = await browser.newPage();
  await page.addInitScript((name) => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("test", name);
    };
  }, name);
  await page.goto(base);
  await page.locator("#start").click();
  await page.waitForFunction(
    () => document.querySelector("#start-error").textContent.length > 0,
  );
  assert.ok(
    (await page.locator("#start-error").innerText()).includes(expected),
  );
  assert.equal(await page.locator("#start").isEnabled(), true);
  await page.close();
}
const page = await browser.newPage({ permissions: ["camera"] });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base);
await page.locator("#start").click();
await page.waitForFunction(
  () => document.querySelector("video").videoWidth > 0,
);
await page.waitForTimeout(6000);
await page.evaluate(() => {
  window.testStream = document.querySelector("video").srcObject;
  window.testStream.getVideoTracks()[0].dispatchEvent(new Event("ended"));
});
await page.waitForFunction(() =>
  document.querySelector("#start-error").textContent.includes("disconnected"),
);
assert.equal(
  await page.evaluate(() =>
    window.testStream.getTracks().every((t) => t.readyState === "ended"),
  ),
  true,
);
await page.locator("#start").click();
await page.waitForFunction(
  () => document.querySelector("video").videoWidth > 0,
);
await page.evaluate(
  () => (window.testStream = document.querySelector("video").srcObject),
);
await page.evaluate(() =>
  window.dispatchEvent(new PageTransitionEvent("pagehide")),
);
assert.equal(
  await page.evaluate(() =>
    window.testStream.getTracks().every((t) => t.readyState === "ended"),
  ),
  true,
);
assert.equal(await page.locator("#world canvas").count(), 0);
assert.deepEqual(errors, []);
console.log(
  "Camera denied/missing/busy, unplug/retry, and track/renderer disposal checks passed.",
);
await browser.close();
