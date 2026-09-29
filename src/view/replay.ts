export interface TransformSnapshot {
  position: [number, number, number];
  rotation: [number, number, number, number];
}
export interface ShotSnapshot {
  t: number;
  ball: TransformSnapshot | null;
  pins: { id: number; transform: TransformSnapshot }[];
}

/** Bounded recording of the actual simulated shot; playback never changes physics or score. */
export class ShotReplay {
  frames: ShotSnapshot[] = [];
  clear() {
    this.frames = [];
  }
  record(frame: ShotSnapshot) {
    if (
      this.frames.length &&
      frame.t - this.frames[this.frames.length - 1].t < 1 / 30
    )
      return;
    this.frames.push(frame);
    if (this.frames.length > 390) this.frames.shift();
  }
  impactStart() {
    const impact = this.frames.find(
      (f) => f.ball && f.ball.position[2] < -17.3,
    );
    return Math.max(0, (impact?.t ?? this.frames[0]?.t ?? 0) - 0.35);
  }
  sample(t: number) {
    if (!this.frames.length) return null;
    let index = this.frames.findIndex((f) => f.t >= t);
    if (index < 0) return this.frames[this.frames.length - 1];
    if (index === 0) return this.frames[0];
    const a = this.frames[index - 1],
      b = this.frames[index];
    const k = (t - a.t) / Math.max(0.00001, b.t - a.t);
    const lerp = (
      a: TransformSnapshot,
      b: TransformSnapshot,
    ): TransformSnapshot => {
      // Normalized shortest-path quaternion interpolation avoids flipping at the seam.
      const sign =
        a.rotation.reduce((sum, x, i) => sum + x * b.rotation[i], 0) < 0
          ? -1
          : 1;
      const q = a.rotation.map((x, i) => x + (b.rotation[i] * sign - x) * k);
      const len = Math.hypot(...q) || 1;
      return {
        position: a.position.map((x, i) => x + (b.position[i] - x) * k) as [
          number,
          number,
          number,
        ],
        rotation: q.map((x) => x / len) as [number, number, number, number],
      };
    };
    return {
      t,
      ball: a.ball && b.ball ? lerp(a.ball, b.ball) : b.ball,
      pins: b.pins.map((p) => ({
        id: p.id,
        transform: lerp(
          a.pins.find((v) => v.id === p.id)?.transform ?? p.transform,
          p.transform,
        ),
      })),
    };
  }
}
