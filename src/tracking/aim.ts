import { TUNING } from "../config";
import { clamp } from "./math";
import type { Hand, PoseFrame } from "./pose";

export interface AimGesture {
  engaged: boolean;
  active: boolean;
  angle?: number;
}
/** Raise the free hand to engage, move relative to the torso, lower to lock.
 * A new engagement anchors to the existing aim, so raising a hand never jumps it.
 */
export class MotionAim {
  private since: number | null = null;
  private lastT = -1;
  private anchor = 0;
  private startingAngle = 0;
  private angle = 0;
  private lastPosition = 0;
  reset() {
    this.since = null;
    this.lastT = -1;
  }
  step(
    pose: PoseFrame,
    hand: Hand,
    currentAim: number,
    enabled: boolean,
  ): AimGesture {
    if (!enabled) {
      this.reset();
      return { engaged: false, active: false };
    }
    const freeWrist = hand === "right" ? 15 : 16;
    const points = [11, 12, 23, 24, freeWrist].map((i) => pose.image[i]);
    const wasEngaged = this.since !== null;
    if (
      points.some(
        (p) =>
          !p ||
          !Number.isFinite(p.x + p.y) ||
          (p.visibility ?? 0) < TUNING.tracking.confidence ||
          p.x < 0.03 ||
          p.x > 0.97 ||
          p.y < 0.02 ||
          p.y > 0.98,
      )
    ) {
      this.reset();
      return { engaged: wasEngaged, active: false };
    }
    const [left, right, hipLeft, hipRight, wrist] = points;
    const shoulderY = (left.y + right.y) / 2,
      hipY = (hipLeft.y + hipRight.y) / 2;
    const torso = hipY - shoulderY;
    const raised =
      torso > 0.06 &&
      wrist.y > shoulderY - 0.3 * torso &&
      wrist.y < hipY - 0.35 * torso;
    if (!raised) {
      this.reset();
      return { engaged: false, active: false };
    }
    const position = ((left.x + right.x) / 2 - wrist.x) / torso;
    if (this.lastT >= pose.t) return { engaged: wasEngaged, active: false };
    const dt = this.lastT < 0 ? 0 : pose.t - this.lastT;
    if (
      dt > TUNING.tracking.maxGapMs ||
      (dt > 0 && Math.abs(position - this.lastPosition) / (dt / 1000) > 5)
    ) {
      this.reset();
      return { engaged: wasEngaged, active: false };
    }
    this.lastT = pose.t;
    this.lastPosition = position;
    if (this.since === null) {
      this.since = pose.t;
      this.anchor = position;
      this.startingAngle = currentAim;
      this.angle = currentAim;
    }
    if (pose.t - this.since < 280) return { engaged: true, active: false };
    const delta = position - this.anchor;
    const travel = Math.sign(delta) * Math.max(0, Math.abs(delta) - 0.045);
    const target = clamp(this.startingAngle + travel * 3, -2.5, 2.5);
    this.angle += (target - this.angle) * (1 - Math.exp(-dt / 110));
    return { engaged: true, active: true, angle: this.angle };
  }
}
