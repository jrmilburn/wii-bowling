import { test } from "node:test";
import assert from "node:assert/strict";
import { MotionAim } from "../src/tracking/aim";
import type { PoseFrame, Hand } from "../src/tracking/pose";
function pose(t: number, x = 0.4, hand: Hand = "right"): PoseFrame {
  const image = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.8,
    z: 0,
    visibility: 1,
  }));
  image[11] = { x: 0.4, y: 0.3, z: 0, visibility: 1 };
  image[12] = { x: 0.6, y: 0.3, z: 0, visibility: 1 };
  image[23] = { x: 0.43, y: 0.6, z: 0, visibility: 1 };
  image[24] = { x: 0.57, y: 0.6, z: 0, visibility: 1 };
  image[hand === "right" ? 15 : 16] = { x, y: 0.4, z: 0, visibility: 1 };
  return { t, image, world: [] };
}
test("raising the free hand holds existing aim, mirrored right motion increases aim, lowering locks it", () => {
  const aim = new MotionAim();
  let value = 0.7;
  for (let t = 0; t < 400; t += 40) {
    const result = aim.step(pose(t), "right", value, true);
    assert.equal(result.engaged, true);
    if (result.angle !== undefined) value = result.angle;
  }
  assert.equal(value, 0.7);
  for (let t = 400; t <= 1200; t += 40) {
    const r = aim.step(
      pose(t, 0.4 - ((t - 400) / 800) * 0.15),
      "right",
      value,
      true,
    );
    if (r.angle !== undefined) value = r.angle;
  }
  assert.ok(value > 1.7 && value < 2.2);
  const down = pose(1240, 0.25);
  down.image[15].y = 0.8;
  assert.deepEqual(aim.step(down, "right", value, true), {
    engaged: false,
    active: false,
  });
});
test("motion aiming requires reliable free-hand tracking and cannot run during a delivery", () => {
  const aim = new MotionAim();
  for (let t = 0; t < 400; t += 40) aim.step(pose(t), "right", 0, true);
  const lost = pose(400);
  lost.image[15].visibility = 0.1;
  assert.deepEqual(aim.step(lost, "right", 0, true), {
    engaged: true,
    active: false,
  });
  assert.deepEqual(aim.step(pose(440, 0.2), "right", 0, false), {
    engaged: false,
    active: false,
  });
});
test("torso translation and small hand jitter do not steer the shot", () => {
  const aim = new MotionAim();
  let value = -0.5;
  for (let t = 0; t < 1000; t += 40) {
    const p = pose(t, 0.4 + Math.sin(t) * 0.002);
    p.image.forEach((v) => (v.x += (0.08 * t) / 1000));
    const r = aim.step(p, "right", value, true);
    if (r.angle !== undefined) value = r.angle;
  }
  assert.equal(value, -0.5);
});
test("left-handed bowling uses the right free hand and rejects stale frames", () => {
  const aim = new MotionAim();
  let value = 0;
  for (let t = 0; t <= 1000; t += 40) {
    const r = aim.step(
      pose(t, 0.4 + (Math.max(0, t - 400) / 600) * 0.12, "left"),
      "left",
      value,
      true,
    );
    if (r.angle !== undefined) value = r.angle;
  }
  assert.ok(value < -0.65);
  assert.equal(
    aim.step(pose(500, 0.2, "left"), "left", value, true).angle,
    undefined,
  );
  assert.equal(
    aim.step(pose(1500, 0.2, "left"), "left", value, true).angle,
    undefined,
  );
});
