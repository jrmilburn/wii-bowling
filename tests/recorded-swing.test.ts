import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { armSample, type Landmark } from "../src/tracking/pose";
import { SwingDetector } from "../src/tracking/swing";

const rows: number[][] = JSON.parse(
  readFileSync(
    new URL("./fixtures/recorded-swing.json", import.meta.url),
    "utf8",
  ),
);
function sample(t: number, points: number[]) {
  const image: Landmark[] = [];
  [11, 12, 23, 24, 14, 16].forEach(
    (id, i) =>
      (image[id] = {
        x: points[2 * i] / 640,
        y: points[2 * i + 1] / 480,
        z: 0,
        visibility: 1,
      }),
  );
  return armSample({ t, image, world: [], aspect: 4 / 3 }, "right");
}
test("visible markers recovered from video 2 recognize the paused backswing and release", () => {
  const d = new SwingDetector();
  const releases: number[] = [];
  const phases = new Set<string>();
  for (const [t, ...points] of rows) {
    if (d.feed(sample(t, points))) releases.push(t);
    phases.add(d.state);
  }
  assert.deepEqual(releases, [8400]);
  assert.ok(phases.has("BACKSWING"));
  assert.ok(phases.has("FORWARD_SWING"));
});
test("recorded swing survives 15, 20 and 30 Hz resampling and frame timing offsets", () => {
  for (const hz of [15, 20, 30])
    for (const offset of [0, 10, 20]) {
      const d = new SwingDetector();
      let i = 0;
      const releases: number[] = [];
      for (let t = rows[0][0] + offset; t < 9000; t += 1000 / hz) {
        while (i + 1 < rows.length && rows[i + 1][0] <= t) i++;
        if (d.feed(sample(t, rows[i].slice(1)))) releases.push(t);
      }
      assert.equal(releases.length, 1, `${hz}Hz +${offset}ms`);
      assert.ok(releases[0] >= 8350 && releases[0] < 8500);
    }
});
