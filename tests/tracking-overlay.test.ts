import { test } from "node:test";
import assert from "node:assert/strict";
import {
  trackingIndicators,
  landmarkStatus,
} from "../src/view/trackingOverlay";
import type { PoseFrame } from "../src/tracking/pose";
test("tracking indicators expose uncertainty on the selected arm only", () => {
  const p: PoseFrame = {
    t: 0,
    world: [],
    image: Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.95,
    })),
  };
  p.image[16].visibility = 0.2;
  assert.equal(
    trackingIndicators(p, "right").find((x) => x.name === "Wrist")?.status,
    "uncertain",
  );
  assert.equal(
    trackingIndicators(p, "left").find((x) => x.name === "Wrist")?.status,
    "tracked",
  );
  p.image[24].x = 1.2;
  assert.equal(
    trackingIndicators(p, "right").find((x) => x.name === "Hips")?.status,
    "missing",
  );
});
test("missing, offscreen and nonfinite landmarks never show as tracked", () => {
  assert.ok(
    trackingIndicators(null, "right").every((x) => x.status === "missing"),
  );
  assert.equal(
    landmarkStatus({ x: NaN, y: 0.4, z: 0, visibility: 1 }),
    "missing",
  );
  assert.equal(
    landmarkStatus({ x: 0.4, y: 0.99, z: 0, visibility: 1 }),
    "missing",
  );
});
