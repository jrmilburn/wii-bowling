import { TUNING as C } from "../config";
import { emaStep, median } from "./math";
import type { ArmSample } from "./pose";
import { throwFromMotion, type Throw } from "../game/throw";
export type MotionState =
  | "CALIBRATING"
  | "READY"
  | "BACKSWING"
  | "FORWARD_SWING"
  | "RELEASED"
  | "RESOLVING";
export class SwingDetector {
  state: MotionState = "CALIBRATING";
  progress = 0;
  armed = false;
  message = "Stand comfortably with your bowling arm relaxed";
  neutral = 0;
  lateralNeutral = 0;
  current: ArmSample | null = null;
  velocity = 0;
  private last: ArmSample | null = null;
  private stableAt: number | null = null;
  private samples: ArmSample[] = [];
  private started = 0;
  private backAt = 0;
  private minForward = 0;
  private calibrated = false;
  private lastT = -1;
  private preparingAt: number | null = null;
  reset() {
    this.calibrated = false;
    this.state = "CALIBRATING";
    this.progress = 0;
    this.last = null;
    this.lastT = -1;
    this.cancel();
  }
  private cancel() {
    this.armed = false;
    this.stableAt = null;
    this.samples = [];
    this.last = null;
    this.velocity = 0;
    this.preparingAt = null;
    if (this.state !== "RELEASED" && this.state !== "RESOLVING")
      this.state = this.calibrated ? "READY" : "CALIBRATING";
  }
  resolving() {
    this.state = "RESOLVING";
  }
  next() {
    this.state = this.calibrated ? "READY" : "CALIBRATING";
    this.cancel();
    this.message = "Relax your arm to get ready";
  }
  lost(reason = "Arm not visible") {
    this.cancel();
    this.current = null;
    this.message = reason;
    this.progress = this.calibrated ? 1 : 0;
  }
  feed(raw: ArmSample): Throw | null {
    if (raw.t <= this.lastT) return null;
    this.lastT = raw.t;
    if (!raw.valid) {
      this.lost(raw.reason);
      return null;
    }
    if (this.state === "RELEASED" || this.state === "RESOLVING") {
      this.current = raw;
      return null;
    }
    const previous = this.last;
    const dt = previous ? raw.t - previous.t : 0;
    if (
      previous &&
      (dt > C.tracking.maxGapMs ||
        Math.hypot(
          raw.forward - previous.forward,
          raw.lateral - previous.lateral,
        ) /
          (dt / 1000) >
          C.tracking.maxJumpPerSecond)
    ) {
      this.lost("Tracking interrupted · relax your arm");
      return null;
    }
    const a = {
      ...raw,
      forward: previous
        ? emaStep(previous.forward, raw.forward, dt, C.tracking.smoothMs)
        : raw.forward,
      lateral: previous
        ? emaStep(previous.lateral, raw.lateral, dt, C.tracking.smoothMs)
        : raw.lateral,
      aim:
        previous && raw.aim !== undefined
          ? emaStep(
              previous.aim ?? raw.aim,
              raw.aim,
              dt,
              C.tracking.smoothMs * 2,
            )
          : raw.aim,
    };
    const vf = previous ? (a.forward - previous.forward) / (dt / 1000) : 0;
    const vl = previous ? (a.lateral - previous.lateral) / (dt / 1000) : 0;
    this.current = a;
    this.last = a;
    this.velocity = vf;
    const low =
      a.atRest ??
      (a.height > C.swing.readyMinHeight && a.elbowCos > C.swing.minElbowCos);
    const inSwingEnvelope =
      a.height > C.swing.swingMinHeight && a.elbowCos > C.swing.minElbowCos;
    const still = low && Math.hypot(vf, vl) < C.swing.readySpeed;
    if (!this.calibrated) {
      this.message = low
        ? "Hold still · arm relaxed at your side"
        : "Lower and relax your bowling arm";
      if (!still) {
        this.stableAt = null;
        this.samples = [];
        this.progress = 0;
        return null;
      }
      this.stableAt ??= a.t;
      this.samples.push(a);
      this.progress = Math.min(
        1,
        (a.t - this.stableAt) / C.swing.calibrationMs,
      );
      if (this.progress === 1) {
        this.neutral = median(this.samples.map((s) => s.forward));
        this.lateralNeutral = median(this.samples.map((s) => s.lateral));
        this.calibrated = true;
        this.state = "READY";
        this.cancel();
        this.message = "Relax your arm to get ready";
      }
      return null;
    }
    const f = a.forward - this.neutral;
    if (this.state === "READY") {
      if (!this.armed) {
        if (still && (a.atRest ?? Math.abs(f) < C.swing.readyRadius)) {
          this.stableAt ??= a.t;
          this.message = "Hold your arm still · getting ready";
          if (a.t - this.stableAt >= C.swing.readyMs) {
            // A stable visible resting arm refreshes the baseline after turning,
            // moving or a tracking dropout. Never rearm against stale depth.
            this.neutral = a.forward;
            this.lateralNeutral = a.lateral;
            this.armed = true;
            this.message = "Ready · swing back, then bowl";
          }
        } else {
          this.stableAt = null;
          this.message = !low
            ? "Lower your bowling arm beside your hip"
            : "Hold your arm still to get ready";
        }
      } else if (inSwingEnvelope && f < -C.swing.backswing) {
        // Recognize the excursion from a stable ready position even when the
        // player pauses at the back. Forward speed is checked at release.
        this.state = "BACKSWING";
        this.preparingAt = null;
        this.started = a.t;
        this.backAt = a.t;
        this.minForward = f;
        this.message = "Bring your arm forward";
      } else if (!inSwingEnvelope) {
        this.cancel();
        this.message = "Keep the swing low · let your arm hang long";
      } else if (
        Math.abs(a.lateral - this.lateralNeutral) > C.swing.maxLateral
      ) {
        this.cancel();
        this.message = "Swing beside your body · keep your stance still";
      } else if (!low || f > C.swing.readyRadius) {
        // A small forward preparation is normal. It never counts as a throw:
        // the player still has to move behind the calibrated resting point.
        this.preparingAt ??= a.t;
        this.message = "Bring your hand behind your hip, then forward";
        if (a.t - this.preparingAt > C.swing.preparationMs) {
          this.cancel();
          this.message =
            "No backswing seen · turn your bowling side toward the camera";
        }
      } else if (still && Math.abs(f) < C.swing.readyRadius) {
        this.preparingAt = null;
        this.message = "Ready · swing back, then bowl";
      }
      return null;
    }
    if (
      a.t - this.started > C.swing.maxSwingMs ||
      !inSwingEnvelope ||
      Math.abs(a.lateral - this.lateralNeutral) > C.swing.maxLateral
    ) {
      this.cancel();
      this.message = !inSwingEnvelope
        ? "Keep the swing low · let your arm hang long"
        : Math.abs(a.lateral - this.lateralNeutral) > C.swing.maxLateral
          ? "Swing beside your body · keep your stance still"
          : "Swing timed out · relax your arm and try again";
      return null;
    }
    this.minForward = Math.min(this.minForward, f);
    if (
      this.state === "BACKSWING" &&
      vf > C.swing.forwardSpeed &&
      a.t - this.backAt >= C.swing.minBackMs
    ) {
      this.state = "FORWARD_SWING";
      this.message = "Bowl through";
    }
    if (this.state === "FORWARD_SWING") {
      if (vf < -0.3) {
        this.cancel();
        this.message = "Swing changed direction · relax your arm and try again";
        return null;
      }
      if (
        f >= C.swing.releaseOffset &&
        a.height >= C.swing.restMinHeight &&
        vf > C.swing.forwardSpeed &&
        f - this.minForward >= C.swing.minTravel
      ) {
        this.state = "RELEASED";
        this.armed = false;
        this.message = "Nice release";
        const aimVelocity =
          previous && a.aim !== undefined && previous.aim !== undefined
            ? Math.max(
                -0.8,
                Math.min(0.8, (a.aim - previous.aim) / (dt / 1000)),
              ) * 0.25
            : vl;
        return throwFromMotion(vf, aimVelocity);
      }
    }
    return null;
  }
}
