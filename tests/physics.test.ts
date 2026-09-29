import { test } from "node:test";
import assert from "node:assert/strict";
import { initPhysics } from "../src/game/physics";
test("physical rack remains upright at rest", async () => {
  const p = await initPhysics();
  for (let i = 0; i < 480; i++) p.step(1 / 120);
  assert.equal(p.pins.filter((x) => p.isDown(x)).length, 0);
  p.dispose();
});
test("ball collides with rack and preserves actual standing pins", async () => {
  const p = await initPhysics();
  p.launch({ speed: 8, angle: 0.007 });
  let count: number | null = null;
  for (let i = 0; i < 1600 && count === null; i++) count = p.step(1 / 120);
  assert.notEqual(count, null);
  assert.ok(count! > 0);
  const standing = p.pins.filter((x) => !p.isDown(x)).map((p) => p.id);
  p.clearFallen();
  assert.deepEqual(
    p.pins.map((p) => p.id),
    standing,
  );
  assert.equal(p.ball, null);
  p.dispose();
});
test("gutter throw resolves and cannot jump back into rack", async () => {
  const p = await initPhysics();
  p.launch({ speed: 8, angle: 0.09 });
  let count: number | null = null;
  for (let i = 0; i < 1600 && count === null; i++) count = p.step(1 / 120);
  assert.equal(count, 0);
  p.dispose();
});
test("slow and maximum arcade speeds resolve with physical pin contact", async () => {
  for (const speed of [4.8, 9.8]) {
    const p = await initPhysics();
    p.launch({ speed, angle: 0 });
    let result: number | null = null;
    for (let i = 0; i < 1600 && result === null; i++) result = p.step(1 / 120);
    assert.ok(
      result !== null && result > 0,
      `speed ${speed} must reach the rack without tunnelling`,
    );
    p.dispose();
  }
});
