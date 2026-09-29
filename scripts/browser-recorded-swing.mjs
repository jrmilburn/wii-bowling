// Offline landmark integration regression. This substitutes worker results and
// does NOT test live webcam accuracy or run MediaPipe on the original footage.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const rows = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/recorded-swing.json", import.meta.url),
    "utf8",
  ),
);
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
try {
  const page = await browser.newPage({ permissions: ["camera"] });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(() => {
    window.replayStatus = [];
    setInterval(() => {
      const phase = document.querySelector("#tracking-phase")?.textContent;
      const message = document.querySelector("#tracking-message")?.textContent;
      const label = phase + " / " + message;
      if (window.replayStatus.at(-1) !== label) window.replayStatus.push(label);
    }, 50);
  });
  await page.route("**/mediapipe/pose-worker.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    const rows=${JSON.stringify(rows)};let start=null,index=0;
    self.onmessage=({data:m})=>{
      if(m.type==='init'){self.postMessage({type:'ready'});return;}
      if(m.type!=='frame')return;
      start??=m.t;const elapsed=m.t-start+rows[0][0];
      while(index+1<rows.length&&rows[index+1][0]<=elapsed)index++;
      const [t,...points]=rows[index];const image=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
      [11,12,23,24,14,16].forEach((id,i)=>image[id]={x:points[2*i]/640,y:points[2*i+1]/480,z:0,visibility:1});
      self.postMessage({type:'pose',image,world:[],aspect:4/3,t:start-rows[0][0]+(index===rows.length-1?elapsed:t),orientationVersion:m.orientationVersion});
      m.bitmap.close();
    };`,
    }),
  );
  await page.goto(process.env.BOWLING_URL ?? "http://127.0.0.1:4173/");
  await page.locator("#start").click();
  await page
    .waitForFunction(
      () =>
        /Nice release/.test(
          document.querySelector("#tracking-message").textContent,
        ),
      {},
      { timeout: 20000 },
    )
    .catch(async (e) => {
      console.log(await page.evaluate(() => window.replayStatus));
      console.log(errors);
      throw e;
    });
  await page.waitForFunction(
    () => !document.querySelector("#result").hidden,
    {},
    { timeout: 20000 },
  );
  const result = await page.locator("#result").innerText();
  const score = await page.locator("#scorecard").innerText();
  await page.waitForFunction(
    () =>
      document.querySelector("#result").hidden &&
      /Ready|ready/.test(document.querySelector("#tracking-phase").textContent),
    {},
    { timeout: 10000 },
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      result,
      score,
      phase: await page.locator("#tracking-phase").innerText(),
    }),
  );
  console.log(
    "Recorded markers trigger a physical delivery, scoring, and automatic return. Live webcam acceptance remains required.",
  );
} finally {
  await browser.close();
}
