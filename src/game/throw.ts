import { TUNING as C } from "../config";
import { clamp } from "../tracking/math";
export interface Throw {
  speed: number;
  angle: number;
}
/** A deliberate aim offset plus a small, unbiased release variation.
 * The noise is sampled once per shot, never per physics step or during replay.
 */
export function controlledThrow(
  delivery: Throw,
  aimDegrees: number,
  variation: boolean,
  random: () => number = Math.random,
): Throw {
  const directionNoise = variation ? (random() - random()) * 0.0025 : 0;
  const speedNoise = variation ? 1 + (random() - random()) * 0.015 : 1;
  return {
    angle: clamp(
      delivery.angle +
        (clamp(aimDegrees, -2.5, 2.5) * Math.PI) / 180 +
        directionNoise,
      -0.075,
      0.075,
    ),
    speed: clamp(
      delivery.speed * speedNoise,
      C.throw.minSpeed,
      C.throw.maxSpeed,
    ),
  };
}
export function throwFromMotion(
  forwardSpeed: number,
  lateralSpeed: number,
): Throw {
  const lateral = Math.abs(lateralSpeed) < C.throw.deadzone ? 0 : lateralSpeed;
  return {
    speed: clamp(
      C.throw.minSpeed +
        Math.max(0, forwardSpeed - C.swing.forwardSpeed) * C.throw.speedGain,
      C.throw.minSpeed,
      C.throw.maxSpeed,
    ),
    angle: clamp(
      (lateral / Math.max(0.7, forwardSpeed)) * C.throw.aimGain,
      -C.throw.maxAngle,
      C.throw.maxAngle,
    ),
  };
}
