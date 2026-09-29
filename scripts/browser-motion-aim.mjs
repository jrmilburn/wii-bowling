// Synthetic landmarks validate gesture/UI integration, not webcam accuracy.
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
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    permissions: ["camera"],
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/mediapipe/pose-worker.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
 let start=null;self.onmessage=({data:m})=>{
  if(m.type==='init'){self.postMessage({type:'ready'});return;}
  if(m.type!=='frame')return;start??=m.t;const age=m.t-start;
  const image=Array.from({length:33},()=>({x:.5,y:.8,z:0,visibility:1}));
  const set=(i,x,y)=>image[i]={x,y,z:0,visibility:1};
  set(11,.4,.3);set(12,.6,.3);set(23,.43,.6);set(24,.57,.6);set(14,.6,.54);set(16,.6,.82);set(13,.4,.55);
  set(15,age<3600?.4:.4-Math.min(1,Math.max(0,(age-4000)/1000))*.16,age>=3600&&age<5900?.4:.82);
  self.postMessage({type:'pose',t:m.t,image,world:[],aspect:4/3,orientationVersion:m.orientationVersion});m.bitmap.close();
 };`,
    }),
  );
  await page.goto("http://127.0.0.1:5174/?dev");
  await page.locator("#start").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#aim-controls")
        .classList.contains("motion-active"),
    {},
    { timeout: 15000 },
  );
  await page.waitForFunction(
    () => Number(document.querySelector("#aim-angle").value) > 1.1,
  );
  assert.equal(
    await page.evaluate(() => window.bowlingDev.physics.active),
    false,
  );
  await page.screenshot({ path: ".tmp/motion-aim-active.png" });
  await page.waitForFunction(
    () =>
      !document
        .querySelector("#aim-controls")
        .classList.contains("motion-active"),
  );
  const locked = await page.locator("#aim-angle").inputValue();
  await page.waitForTimeout(900);
  assert.equal(await page.locator("#aim-angle").inputValue(), locked);
  assert.equal(
    await page.evaluate(() => window.bowlingDev.physics.active),
    false,
  );
  await page.locator("#aim-center").click();
  assert.equal(await page.locator("#aim-angle").inputValue(), "0");
  await page.locator("#aim-right").click();
  assert.equal(await page.locator("#aim-angle").inputValue(), "0.1");
  const width = await page
    .locator("#camera-panel")
    .evaluate((e) => e.getBoundingClientRect().width);
  assert.equal(width, 420);
  await page.screenshot({ path: ".tmp/aim-camera-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".tmp/aim-camera-mobile.png" });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      lockedAim: locked,
      cameraWidth: width,
      errors,
      note: "Synthetic gesture integration; live use still needs user verification.",
    }),
  );
} finally {
  await browser.close();
}
