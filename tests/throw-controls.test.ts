import { test } from "node:test";
import assert from "node:assert/strict";
import { controlledThrow } from "../src/game/throw";
test("manual aim is added to the swing, with repeatable variation-free practice", () => {
  const delivery = { speed: 7, angle: 0.004 };
  const shot = controlledThrow(delivery, 1, false, () => {
    throw new Error("Practice must not sample randomness");
  });
  assert.equal(shot.speed, 7);
  assert.equal(shot.angle, 0.004 + Math.PI / 180);
  assert.equal(controlledThrow(delivery, 0, false).angle, delivery.angle);
  assert.deepEqual(delivery, { speed: 7, angle: 0.004 });
});
test("shot randomness is bounded and cannot overpower deliberate aim", () => {
  let index = 0;
  const sequence = [1, 0, 1, 0];
  const shot = controlledThrow(
    { speed: 8, angle: 0 },
    1,
    true,
    () => sequence[index++],
  );
  assert.ok(Math.abs(shot.angle - Math.PI / 180) <= 0.002501);
  assert.ok(Math.abs(shot.speed - 8) <= 0.12001);
  assert.equal(index, 4);
  assert.ok(
    controlledThrow({ speed: 9.8, angle: 0 }, -1, true, () => 1).angle < 0,
  );
});
