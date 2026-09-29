import { TUNING } from "../config";
import { sub, dot, len, unit, type Vec } from "./math";
export type Hand = "right" | "left";
export interface Landmark extends Vec {
  visibility?: number;
  presence?: number;
}
export interface PoseFrame {
  t: number;
  world: Landmark[];
  image: Landmark[];
  aspect?: number;
  silhouette?: { width: number; height: number; pixels: Uint8Array };
}
export interface ArmSample {
  t: number;
  forward: number;
  lateral: number;
  height: number;
  elbowCos: number;
  valid: boolean;
  reason: string;
  /** Image-space relaxed-arm check, independent of inferred depth. */
  atRest?: boolean;
  /** Optional world-space sideways estimate, used only for gentle aiming. */
  aim?: number;
}
export function armSample(frame: PoseFrame, hand: Hand): ArmSample {
  const { world: w, image: im, t } = frame;
  const s = hand === "right" ? 12 : 11,
    e = s + 2,
    h = s + 4,
    hip = s + 12;
  const bad = (reason: string): ArmSample => ({
    t,
    forward: 0,
    lateral: 0,
    height: 0,
    elbowCos: 0,
    valid: false,
    reason,
  });
  const required = [11, 12, 23, 24, e, h];
  if (
    required.some(
      (i) =>
        !im[i] ||
        !Number.isFinite(im[i].x + im[i].y) ||
        (im[i].visibility ?? 0) < TUNING.tracking.confidence,
    )
  )
    return bad("Arm not visible · turn slightly toward the camera");
  if (
    required.some(
      (i) =>
        im[i].x < 0.035 ||
        im[i].x > 0.965 ||
        im[i].y < 0.025 ||
        im[i].y > 0.975,
    )
  )
    return bad("Step back · keep shoulders, hips and hand in view");
  const scale = (im[23].y - im[11].y + (im[24].y - im[12].y)) / 2;
  if (scale < 0.08) return bad("Show your shoulders and hips · stand upright");
  const aspect = frame.aspect ?? 4 / 3;
  const imageVector = (a: Landmark, b: Landmark) => ({
    x: (a.x - b.x) * aspect,
    y: a.y - b.y,
    z: 0,
  });
  const height = (im[h].y - im[s].y) / scale;
  const elbowCos = dot(
    unit(imageVector(im[e], im[s])),
    unit(imageVector(im[h], im[e])),
  );
  // With the bowling side nearer the camera, backward is away from the body's
  // centre in the image. Do not infer swing depth from MediaPipe's noisy Z axis,
  // or rotate the measurement frame whenever its shoulder-depth estimate changes.
  const forward =
    (((im[h].x - im[hip].x) * aspect) / scale) * (hand === "right" ? 1 : -1);
  let aim = 0;
  if (
    [11, 12, 23, 24, h].every(
      (i) => w[i] && Number.isFinite(w[i].x + w[i].y + w[i].z),
    )
  ) {
    const worldScale = (len(sub(w[11], w[23])) + len(sub(w[12], w[24]))) / 2;
    if (worldScale > 0.15) {
      const right = unit({ x: w[12].x - w[11].x, y: 0, z: w[12].z - w[11].z });
      aim = dot(sub(w[h], w[hip]), right) / worldScale;
    }
  }
  return {
    t,
    forward,
    // Screen-horizontal travel is the bowling path, not a sideways fault.
    lateral: 0,
    height,
    elbowCos,
    atRest:
      height >= TUNING.swing.restMinHeight &&
      (Math.abs(im[h].x - im[s].x) * aspect) / scale <
        TUNING.swing.restMaxReach &&
      elbowCos > TUNING.swing.minElbowCos,
    aim,
    valid: true,
    reason: "Ready",
  };
}
