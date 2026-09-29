export interface Frame {
  rolls: number[];
  complete: boolean;
  score: number | null;
  total: number | null;
}
export class ScoreGame {
  frames: number[][] = Array.from({ length: 10 }, () => []);
  index = 0;
  done = false;
  get remaining(): number {
    const r = this.frames[this.index];
    if (this.index < 9) return 10 - (r[0] ?? 0);
    if (r.length === 0) return 10;
    if (r.length === 1) return r[0] === 10 ? 10 : 10 - r[0];
    if (r[0] === 10) return r[1] === 10 ? 10 : 10 - r[1];
    return 10;
  }
  roll(pins: number): {
    freshRack: boolean;
    finished: boolean;
    strike: boolean;
    spare: boolean;
  } {
    if (this.done) throw new Error("Game is complete");
    if (!Number.isInteger(pins) || pins < 0 || pins > this.remaining)
      throw new Error("Invalid pin count");
    const r = this.frames[this.index];
    const before = this.remaining;
    const fresh =
      r.length === 0 ||
      (this.index === 9 &&
        (r.length === 1 ? r[0] === 10 : r[0] < 10 || r[1] === 10));
    r.push(pins);
    const strike = pins === 10 && fresh;
    const spare =
      (!strike && r.length >= 2 && pins === before && before < 10) ||
      (!strike && r.length === 2 && r[0] + r[1] === 10);
    let freshRack = false;
    if (this.index < 9) {
      if (pins === 10 || r.length === 2) {
        this.index++;
        freshRack = true;
      }
    } else {
      this.done = (r.length === 2 && r[0] + r[1] < 10) || r.length === 3;
      freshRack =
        !this.done &&
        (pins === 10 || (r.length === 2 && r[0] < 10 && r[0] + r[1] === 10));
    }
    return { freshRack, finished: this.done, strike, spare };
  }
  scorecard(): Frame[] {
    let total: number | null = 0;
    return this.frames.map((r, i) => {
      const next = this.frames.slice(i + 1).flat();
      let score: number | null = null;
      const complete =
        i === 9
          ? r.length === 3 || (r.length === 2 && r[0] + r[1] < 10)
          : r[0] === 10 || r.length === 2;
      if (i === 9) {
        if (complete) score = r.reduce((a, b) => a + b, 0);
      } else if (r[0] === 10) {
        if (next.length >= 2) score = 10 + next[0] + next[1];
      } else if (r.length === 2) {
        if (r[0] + r[1] === 10) {
          if (next.length) score = 10 + next[0];
        } else score = r[0] + r[1];
      }
      total = total === null || score === null ? null : total + score;
      return { rolls: [...r], complete, score, total };
    });
  }
  get total() {
    return this.scorecard().reduce((n, f) => f.total ?? n, 0);
  }
}
export function rollMarks(r: number[], tenth = false): string[] {
  return r.map((v, i) => {
    if (i === 0) return v === 10 ? "X" : v === 0 ? "–" : String(v);
    const fresh =
      tenth &&
      (i === 1
        ? r[0] === 10
        : (r[0] < 10 && r[0] + r[1] === 10) || r[1] === 10);
    if (fresh && v === 10) return "X";
    if (!fresh && r[i - 1] + v === 10) return "/";
    return v === 0 ? "–" : String(v);
  });
}
