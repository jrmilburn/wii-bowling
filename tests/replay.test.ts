import { test } from "node:test";
import assert from "node:assert/strict";
import { ShotReplay, type ShotSnapshot } from "../src/view/replay";
const frame = (t: number, z: number): ShotSnapshot => ({
  t,
  ball: { position: [0, 0.108, z], rotation: [0, 0, 0, 1] },
  pins: [
    { id: 3, transform: { position: [0.1, 0, -18], rotation: [0, 0, 0, 1] } },
  ],
});
test("replay interpolates the recorded delivery without mutating it", () => {
  const replay = new ShotReplay();
  const a = frame(0, 0),
    b = frame(1, -18);
  b.ball!.rotation = [0, 0, 0, -1];
  replay.record(a);
  replay.record(b);
  const sample = replay.sample(0.5)!;
  assert.equal(sample.ball!.position[2], -9);
  assert.deepEqual(sample.ball!.rotation, [0, 0, 0, 1]);
  assert.equal(a.ball!.position[2], 0);
  assert.equal(b.ball!.position[2], -18);
  assert.equal(replay.impactStart(), 0.65);
  assert.equal(replay.sample(20)!.t, 1);
});
test("replay is bounded and resets between deliveries", () => {
  const replay = new ShotReplay();
  for (let i = 0; i < 1000; i++) replay.record(frame(i / 25, -i));
  assert.equal(replay.frames.length, 390);
  replay.clear();
  assert.equal(replay.sample(0), null);
});
