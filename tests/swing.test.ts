import { test } from "node:test";
import assert from "node:assert/strict";
import { SwingDetector } from "../src/tracking/swing";
import { armSample, type ArmSample, type Landmark } from "../src/tracking/pose";
function harness() {
  const d = new SwingDetector();
  let t = 0;
  let releases = 0;
  const feed = (f = 0, l = 0, valid = true, step = 40, height = 1.2) => {
    t += step;
    const s: ArmSample = {
      t,
      forward: f,
      lateral: l,
      height,
      elbowCos: 0.98,
      valid,
      reason: "Arm not visible",
    };
    const out = d.feed(s);
    if (out) releases++;
    return out;
  };
  const hold = (n = 90) => {
    for (let i = 0; i < n; i++) feed();
  };
  const swing = () => {
    for (const v of [
      -0.08, -0.18, -0.3, -0.44, -0.57, -0.66, -0.7, -0.68, -0.6, -0.48, -0.32,
      -0.12, 0.09, 0.3, 0.55, 0.75,
    ])
      feed(v);
  };
  return {
    d,
    feed,
    hold,
    swing,
    get releases() {
      return releases;
    },
  };
}
test("calibrates, rearms, and releases once during forward swing", () => {
  const h = harness();
  h.hold();
  assert.equal(h.d.state, "READY");
  assert.equal(h.d.armed, true);
  h.swing();
  assert.equal(h.releases, 1);
  assert.equal(h.d.state, "RELEASED");
  for (let i = 0; i < 10; i++) h.swing();
  assert.equal(h.releases, 1);
});
test("modest forward preparation stays armed but still needs a backswing", () => {
  const h = harness();
  h.hold();
  for (const f of [0.08, 0.18, 0.28, 0.35]) h.feed(f, 0, true, 40, 0.54);
  assert.equal(h.d.armed, true);
  assert.equal(h.releases, 0);
  assert.match(h.d.message, /behind your hip/);
  for (const f of [0.26, 0.15, 0.03]) h.feed(f);
  h.swing();
  assert.equal(h.releases, 1);
});
test("holding preparation without a backswing times out with actionable guidance", () => {
  const h = harness();
  h.hold();
  let sawTimeout = false;
  for (let i = 0; i < 52; i++) {
    h.feed(0.35, 0, true, 40, 0.54);
    sawTimeout ||= /No backswing seen/.test(h.d.message);
  }
  assert.equal(h.releases, 0);
  assert.equal(h.d.armed, false);
  assert.ok(sawTimeout);
  assert.match(h.d.message, /Lower your bowling arm/);
});
test("returning a prepared arm to rest does not release", () => {
  const h = harness();
  h.hold();
  for (const f of [0.1, 0.2, 0.35, 0.25, 0.15, 0.05, 0])
    h.feed(f, 0, true, 40, 0.54);
  h.hold();
  assert.equal(h.releases, 0);
});
test("overhead preparation and cross-body waves still disarm", () => {
  const h = harness();
  h.hold();
  h.feed(0.15, 0, true, 40, -0.3);
  assert.equal(h.d.armed, false);
  assert.match(h.d.message, /Keep the swing low/);
  h.hold();
  let sawLateralFault = false;
  for (let i = 0; i < 12; i++) {
    h.feed(0, i * 0.075);
    sawLateralFault ||= /beside your body/.test(h.d.message);
  }
  assert.equal(h.d.armed, false);
  assert.equal(h.releases, 0);
  assert.ok(sawLateralFault);
});
test("a higher backswing remains valid after entering from a low ready pose", () => {
  const h = harness();
  h.hold();
  for (const f of [-0.08, -0.2, -0.4, -0.6]) h.feed(f);
  for (const f of [-0.8, -1, -1.1, -1, -0.8]) h.feed(f, 0, true, 40, 0.2);
  for (const f of [-0.6, -0.4, -0.2, 0, 0.2, 0.4]) h.feed(f);
  assert.equal(h.releases, 1);
});
function imagePose(hand: "left" | "right", f: number) {
  const image: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));
  image[11] = { x: 0.6, y: 0.2, z: 0, visibility: 1 };
  image[12] = { x: 0.4, y: 0.2, z: 0, visibility: 1 };
  image[23] = { x: 0.6, y: 0.6, z: 0, visibility: 1 };
  image[24] = { x: 0.4, y: 0.6, z: 0, visibility: 1 };
  const s = hand === "left" ? 11 : 12;
  const x = image[s].x + ((f * 0.4) / (4 / 3)) * (hand === "right" ? 1 : -1);
  image[s + 2] = { x: (image[s].x + x) / 2, y: 0.45, z: 0, visibility: 1 };
  image[s + 4] = { x, y: 0.7, z: 0, visibility: 1 };
  return image;
}
test("visible relaxed arm refreshes a stale baseline after stance change and tracking loss", () => {
  const d = new SwingDetector();
  let t = 0,
    releases = 0;
  const send = (f: number) => {
    t += 40;
    if (
      d.feed(armSample({ t, image: imagePose("right", f), world: [] }, "right"))
    )
      releases++;
  };
  for (let i = 0; i < 90; i++) send(0);
  d.lost("Step back");
  send(0.3);
  assert.equal(d.armed, false);
  assert.doesNotMatch(d.message, /Step back/);
  for (let i = 0; i < 20; i++) send(0.3);
  assert.equal(d.armed, true);
  assert.ok(Math.abs(d.neutral - 0.3) < 0.01);
  assert.equal(releases, 0);
  for (const f of [
    0.22, 0.1, -0.1, -0.3, -0.4, -0.45, -0.4, -0.3, -0.1, 0.1, 0.3, 0.5, 0.7,
  ])
    send(f);
  assert.equal(releases, 1);
});
test("shoulder-height sideways waving cannot release through the visible pose path", () => {
  const d = new SwingDetector();
  let t = 0,
    releases = 0;
  const send = (f: number, raised = false) => {
    const image = imagePose("right", f);
    if (raised) {
      image[14].y = 0.23;
      image[16].y = 0.26;
    }
    if (d.feed(armSample({ t: (t += 40), image, world: [] }, "right")))
      releases++;
  };
  for (let i = 0; i < 90; i++) send(0);
  for (const f of [
    -0.08, -0.18, -0.3, -0.44, -0.57, -0.66, -0.7, -0.68, -0.6, -0.48, -0.32,
    -0.12, 0.09, 0.3, 0.55,
  ])
    send(f, true);
  assert.equal(releases, 0);
});
test("whole-body translation and unreliable world depth do not change visible swing position", () => {
  const image = imagePose("right", 0.2);
  const baseline = armSample({ t: 0, image, world: [] }, "right");
  const moved = image.map((p) => ({ ...p, x: p.x + 0.1, y: p.y + 0.1 }));
  const world = image.map((p) => ({ ...p, z: Number.NaN }));
  const sample = armSample({ t: 40, image: moved, world }, "right");
  assert.ok(sample.valid);
  assert.ok(Math.abs(sample.forward - baseline.forward) < 1e-6);
});
test("timestamped visible landmark swings work for either anatomical hand without world depth", () => {
  for (const hand of ["left", "right"] as const) {
    const detector = new SwingDetector();
    let t = 0,
      releases = 0;
    const send = (f: number) => {
      const image = imagePose(hand, f);
      t += 40;
      if (detector.feed(armSample({ t, world: [], image }, hand))) releases++;
    };
    for (let i = 0; i < 90; i++) send(0);
    for (const f of [
      -0.08, -0.18, -0.3, -0.44, -0.57, -0.66, -0.7, -0.68, -0.6, -0.48, -0.32,
      -0.12, 0.09, 0.3, 0.55, 0.75,
    ])
      send(f);
    assert.equal(releases, 1);
  }
});
test("idle and lateral waves cannot release", () => {
  const h = harness();
  h.hold();
  for (let i = 0; i < 100; i++) h.feed(Math.sin(i) * 0.05, Math.cos(i) * 0.08);
  assert.equal(h.releases, 0);
  for (let i = 0; i < 30; i++) h.feed(0, Math.sin(i) * 0.7);
  assert.equal(h.releases, 0);
});
test("forward-only motion and returning to rest cannot release", () => {
  const h = harness();
  h.hold();
  for (const v of [0.1, 0.3, 0.5, 0.7, 0.5, 0.3, 0.1, 0]) h.feed(v);
  assert.equal(h.releases, 0);
});
test("tracking loss cancels backswing, reacquisition does not launch", () => {
  const h = harness();
  h.hold();
  for (const v of [-0.1, -0.3, -0.5, -0.65]) h.feed(v);
  h.feed(0, 0, false);
  for (const v of [-0.4, -0.1, 0.2, 0.6]) h.feed(v);
  assert.equal(h.releases, 0);
  assert.equal(h.d.armed, false);
  h.hold();
  h.swing();
  assert.equal(h.releases, 1);
});
test("large timestamp gap cancels, duplicate and stale timestamps ignored", () => {
  const h = harness();
  h.hold();
  h.feed(-0.5);
  h.feed(0.3, 0, true, 400);
  assert.equal(h.releases, 0);
  assert.equal(h.d.armed, false);
  h.d.feed({
    t: 1,
    valid: true,
    forward: 3,
    lateral: 0,
    height: 1.2,
    elbowCos: 1,
    reason: "",
  });
  assert.equal(h.releases, 0);
});
test("one delivery per resolve cycle and fresh stable ready required", () => {
  const h = harness();
  h.hold();
  h.swing();
  h.d.resolving();
  h.hold();
  h.swing();
  assert.equal(h.releases, 1);
  h.d.next();
  h.swing();
  assert.equal(h.releases, 1);
  h.hold();
  h.swing();
  assert.equal(h.releases, 2);
});
test("glitch and bent/high arm cannot trigger a throw", () => {
  const h = harness();
  h.hold();
  h.feed(-3);
  h.feed(3);
  assert.equal(h.releases, 0);
  assert.equal(h.d.armed, false);
});
test("calibration requires continuous visible still arm", () => {
  const h = harness();
  h.hold(20);
  h.feed(0, 0, false);
  h.hold(20);
  assert.equal(h.d.state, "CALIBRATING");
  assert.ok(h.d.progress < 1);
});
test("body-relative pose maps both hands and rejects low confidence", () => {
  for (const hand of ["left", "right"] as const) {
    const w: Landmark[] = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 1,
    }));
    w[11] = { x: 0.2, y: 0, z: 0 };
    w[12] = { x: -0.2, y: 0, z: 0 };
    w[23] = { x: 0.2, y: 0.5, z: 0 };
    w[24] = { x: -0.2, y: 0.5, z: 0 };
    const s = hand === "left" ? 11 : 12;
    w[s + 2] = { x: w[s].x, y: 0.35, z: 0 };
    w[s + 4] = { x: w[s].x, y: 0.7, z: -0.2 };
    const image = imagePose(hand, 0.2);
    const a = armSample({ t: 0, world: w, image }, hand);
    assert.ok(a.valid);
    assert.ok(a.forward > 0);
    assert.ok(a.height > 1);
    image[s + 4].visibility = 0.1;
    assert.equal(armSample({ t: 1, world: w, image }, hand).valid, false);
  }
});
