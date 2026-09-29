export class AlleyAudio {
  private ctx: AudioContext | null = null;
  private rolling: AudioBufferSourceNode | null = null;
  private rollGain: GainNode | null = null;
  private lastHit = 0;
  muted = false;
  async start() {
    this.ctx ??= new AudioContext();
    await this.ctx.resume();
  }
  private noise(seconds: number) {
    const c = this.ctx!;
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    return b;
  }
  roll(on: boolean) {
    this.rolling?.stop();
    this.rolling = null;
    this.rollGain = null;
    if (!on || !this.ctx || this.muted) return;
    const c = this.ctx,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = this.noise(2);
    s.loop = true;
    f.type = "lowpass";
    f.frequency.value = 260;
    g.gain.value = 0.07;
    s.connect(f).connect(g).connect(c.destination);
    s.start();
    this.rolling = s;
    this.rollGain = g;
  }
  impact(strength: number) {
    if (!this.ctx || this.muted || performance.now() - this.lastHit < 60)
      return;
    this.lastHit = performance.now();
    const c = this.ctx,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = this.noise(0.14);
    f.type = "bandpass";
    f.frequency.value = 700 + Math.random() * 900;
    g.gain.setValueAtTime(
      Math.min(0.32, 0.035 + strength * 0.025),
      c.currentTime,
    );
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
    s.connect(f).connect(g).connect(c.destination);
    s.start();
  }
  celebrate(big: boolean) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx;
    [523, 659, 784, ...(big ? [1047] : [])].forEach((f, i) => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, c.currentTime + i * 0.11);
      g.gain.linearRampToValueAtTime(0.12, c.currentTime + i * 0.11 + 0.012);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        c.currentTime + i * 0.11 + 0.4,
      );
      o.connect(g).connect(c.destination);
      o.start(c.currentTime + i * 0.11);
      o.stop(c.currentTime + i * 0.11 + 0.42);
    });
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.rollGain) this.rollGain.gain.value = muted ? 0 : 0.07;
  }
  dispose() {
    this.roll(false);
    void this.ctx?.close();
    this.ctx = null;
  }
}
