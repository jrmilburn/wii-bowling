import type { PoseFrame } from "./pose";
import { TUNING } from "../config";
// Camera constraints, local asset layout, duplicate-frame suppression and lifecycle
// follow Mario Kart's HandTracker. Inference moves to a worker for bowling rendering.
export class CameraTracker {
  readonly video = document.createElement("video");
  hz: number = TUNING.tracking.hz;
  private stream: MediaStream | null = null;
  private worker: Worker | null = null;
  private timer = 0;
  private token = 0;
  private busy = false;
  private live = false;
  private lastVideo = -1;
  private sentAt = 0;
  private rotated = false;
  private orientationVersion = 0;
  private rotationCanvas = document.createElement("canvas");
  setUpsideDown(enabled: boolean) {
    if (this.rotated === enabled) return;
    this.rotated = enabled;
    this.orientationVersion++;
    this.video.style.transform = enabled
      ? "scaleX(-1) rotate(180deg)"
      : "scaleX(-1)";
  }
  onPose: (p: PoseFrame) => void = () => {};
  onStatus: (s: string) => void = () => {};
  constructor(private silhouette = false) {
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;
  }
  async start() {
    this.stop();
    const token = this.token;
    this.onStatus("Opening camera…");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Camera needs HTTPS or localhost. Open this game on a secure address.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });
      if (token !== this.token) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      stream
        .getTracks()
        .forEach((t) =>
          t.addEventListener("ended", () =>
            this.fail("Camera disconnected · reconnect it and try again"),
          ),
        );
      this.video.srcObject = stream;
      await this.video.play();
      if (token !== this.token) return;
      this.onStatus("Loading body tracking…");
      this.worker = new Worker("/mediapipe/pose-worker.js");
      this.worker.onerror = () =>
        this.fail("Body tracking could not load · reload and try again");
      this.worker.onmessage = (e) => {
        if (token !== this.token) return;
        if (e.data.type === "ready") {
          this.live = true;
          this.busy = false;
          this.onStatus("Camera ready");
        } else if (e.data.type === "pose") {
          this.busy = false;
          // Ignore an inference started before the player changed orientation.
          if (e.data.orientationVersion === this.orientationVersion)
            this.onPose(e.data);
        } else if (e.data.type === "error") {
          console.error(e.data.message);
          this.fail("Body tracking stopped · restart camera");
        }
      };
      this.worker.postMessage({ type: "init", base: location.origin, silhouette: this.silhouette });
      this.sentAt = performance.now();
      const tick = async () => {
        if (token !== this.token) return;
        if (
          (this.busy || !this.live) &&
          performance.now() - this.sentAt > 30000
        ) {
          this.fail("Tracking took too long to respond · restart camera");
          return;
        }
        if (
          this.live &&
          !this.busy &&
          !document.hidden &&
          this.video.readyState >= 2 &&
          this.video.currentTime !== this.lastVideo
        ) {
          this.busy = true;
          this.lastVideo = this.video.currentTime;
          this.sentAt = performance.now();
          try {
            const orientationVersion = this.orientationVersion;
            let source: HTMLVideoElement | HTMLCanvasElement = this.video;
            if (this.rotated) {
              const canvas = this.rotationCanvas;
              if (
                canvas.width !== this.video.videoWidth ||
                canvas.height !== this.video.videoHeight
              ) {
                canvas.width = this.video.videoWidth;
                canvas.height = this.video.videoHeight;
              }
              const context = canvas.getContext("2d")!;
              context.setTransform(-1, 0, 0, -1, canvas.width, canvas.height);
              context.drawImage(this.video, 0, 0);
              source = canvas;
            }
            const bitmap = await createImageBitmap(source);
            if (token !== this.token) {
              bitmap.close();
              return;
            }
            this.worker?.postMessage(
              { type: "frame", bitmap, t: this.sentAt, orientationVersion },
              [bitmap],
            );
          } catch {
            this.fail("Could not read the camera · restart camera");
            return;
          }
        }
        this.timer = window.setTimeout(tick, 1000 / this.hz);
      };
      void tick();
    } catch (e) {
      if (token !== this.token) return;
      const name = (e as Error).name;
      this.fail(
        name === "NotAllowedError"
          ? "Camera permission denied · allow camera access in your browser, then try again"
          : name === "NotFoundError"
            ? "No camera found · connect a webcam, then try again"
            : name === "NotReadableError"
              ? "Camera is busy · close other camera apps, then try again"
              : (e as Error).message,
      );
    }
  }
  private fail(message: string) {
    this.stop();
    this.onStatus(message);
  }
  stop() {
    this.token++;
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.worker = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.live = false;
    this.busy = false;
    this.lastVideo = -1;
  }
}
