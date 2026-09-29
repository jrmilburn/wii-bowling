export interface Vec {
  x: number;
  y: number;
  z: number;
}
export const sub = (a: Vec, b: Vec): Vec => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a: Vec) => Math.hypot(a.x, a.y, a.z);
export const unit = (a: Vec): Vec => {
  const n = len(a) || 1;
  return { x: a.x / n, y: a.y / n, z: a.z / n };
};
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
// Reused verbatim from Mario Kart src/game/hands/gestures.ts.
export function emaStep(
  current: number,
  target: number,
  dtMs: number,
  tauMs: number,
): number {
  if (dtMs <= 0) return current;
  return current + (target - current) * (1 - Math.exp(-dtMs / tauMs));
}
export const median = (ns: number[]) =>
  [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)] ?? 0;
