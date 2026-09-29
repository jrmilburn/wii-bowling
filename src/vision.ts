import "./vision.css";
import { CameraTracker } from "./tracking/camera";
import type { PoseFrame } from "./tracking/pose";
import { landmarkStatus } from "./view/trackingOverlay";

document.querySelector("#vision")!.innerHTML = `
 <div id="feed"><canvas id="body-outline" aria-label="Live body outline and joint tracking"></canvas></div>
 <header><div><h1>Body tracking</h1><p id="vision-status" role="status">Enable your camera to see your outline.</p></div><button id="fullscreen">Full screen</button></header>
 <div id="empty-state"><p>See your whole movement.</p><span>Step back until your head and feet are in view.</span><button id="connect">Start camera</button></div>
 <footer><div class="controls"><button id="reconnect">Restart camera</button><label><input type="checkbox" id="rotate" checked> Rotate 180°</label><label><input type="checkbox" id="show-video" checked> Camera</label><label><input type="checkbox" id="show-joints" checked> Joints</label></div><p><span class="key"></span>Tracked <span class="key uncertain"></span>Uncertain <span id="tracking-rate">Waiting for camera</span></p><small>Live on this device · nothing is recorded</small></footer>`;
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const tracker = new CameraTracker(true);
const canvas = get<HTMLCanvasElement>("body-outline"),
  ctx = canvas.getContext("2d")!;
const maskCanvas = document.createElement("canvas"),
  maskCtx = maskCanvas.getContext("2d")!;
const feed = get("feed");
feed.prepend(tracker.video);
let lastPose: PoseFrame | null = null,
  received = 0,
  starting = false,
  live = false,
  samples: number[] = [];
try {
  get<HTMLInputElement>("rotate").checked =
    localStorage.getItem("camera-upside-down") !== "false";
} catch {}
tracker.setUpsideDown(get<HTMLInputElement>("rotate").checked);
get<HTMLInputElement>("rotate").onchange = () => {
  const rotated = get<HTMLInputElement>("rotate").checked;
  tracker.setUpsideDown(rotated);
  lastPose = null;
  draw(null);
  try {
    localStorage.setItem("camera-upside-down", String(rotated));
  } catch {}
};
get<HTMLInputElement>("show-video").onchange = () =>
  (tracker.video.style.opacity = get<HTMLInputElement>("show-video").checked
    ? "1"
    : "0");
get<HTMLInputElement>("show-joints").onchange = () => draw(lastPose);
get("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    get("vision-status").textContent =
      "Use F11 to enter full screen in your browser.";
  }
};
document.addEventListener(
  "fullscreenchange",
  () =>
    (get("fullscreen").textContent = document.fullscreenElement
      ? "Exit full screen"
      : "Full screen"),
);
const connections = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [23, 25],
  [25, 27],
  [27, 29],
  [29, 31],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],
  [28, 32],
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
];
function draw(pose: PoseFrame | null) {
  const w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!pose?.image.length) return;
  if (pose.silhouette) {
    const { width, height, pixels } = pose.silhouette;
    maskCanvas.width = width;
    maskCanvas.height = height;
    const image = maskCtx.createImageData(width, height);
    for (let y = 1; y < height - 1; y++)
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (pixels[i] < 128) continue;
        const edge =
          pixels[i - 1] < 128 ||
          pixels[i + 1] < 128 ||
          pixels[i - width] < 128 ||
          pixels[i + width] < 128;
        const j = (y * width + (width - 1 - x)) * 4;
        image.data[j] = 92;
        image.data[j + 1] = 255;
        image.data[j + 2] = 190;
        image.data[j + 3] = edge ? 245 : 32;
      }
    maskCtx.putImageData(image, 0, 0);
    ctx.drawImage(maskCanvas, 0, 0, w, h);
  }
  if (!get<HTMLInputElement>("show-joints").checked) return;
  const xy = (id: number) => ({
    x: (1 - pose.image[id].x) * w,
    y: pose.image[id].y * h,
  });
  ctx.lineCap = "round";
  for (const [a, b] of connections) {
    if (!pose.image[a] || !pose.image[b]) continue;
    const sa = landmarkStatus(pose.image[a]),
      sb = landmarkStatus(pose.image[b]);
    if (sa === "missing" || sb === "missing") continue;
    const good = sa === "tracked" && sb === "tracked",
      p = xy(a),
      q = xy(b);
    ctx.strokeStyle = good ? "#70ffbe" : "#ffc46b";
    ctx.lineWidth = w * 0.004;
    ctx.setLineDash(good ? [] : [7, 7]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (let i = 0; i < pose.image.length; i++) {
    const state = landmarkStatus(pose.image[i]);
    if (state === "missing") continue;
    const p = xy(i);
    ctx.beginPath();
    ctx.arc(p.x, p.y, i < 11 ? 2.5 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = state === "tracked" ? "#dbffed" : "#ffc46b";
    ctx.fill();
    ctx.strokeStyle = "#163d37";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
tracker.video.addEventListener("loadedmetadata", () => {
  const w = tracker.video.videoWidth || 640,
    h = tracker.video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;
  feed.style.aspectRatio = `${w}/${h}`;
  feed.style.width = `min(100vw, calc(100dvh * ${w / h}))`;
});
tracker.onPose = (pose) => {
  lastPose = pose;
  received = performance.now();
  samples.push(received);
  samples = samples.filter((t) => received - t < 1500);
  draw(pose);
  const tracked = pose.image.filter(
    (p) => landmarkStatus(p) === "tracked",
  ).length;
  get("vision-status").textContent = tracked
    ? `${tracked} / 33 joints tracked${[27, 28].every((id) => landmarkStatus(pose.image[id]) === "tracked") ? " · Full body in view" : " · Step back to include your feet"}`
    : "No body detected · step into the camera view";
  get("tracking-rate").textContent =
    samples.length > 1
      ? `${Math.round(((samples.length - 1) * 1000) / (samples.at(-1)! - samples[0]))} tracking fps`
      : "Tracking started";
};
tracker.onStatus = (message) => {
  get("vision-status").textContent = message;
  live = message === "Camera ready";
  if (live) {
    get("empty-state").hidden = true;
    get("reconnect").textContent = "Restart camera";
  } else if (!message.endsWith("…")) {
    get("empty-state").hidden = false;
    get("connect").textContent = "Try camera again";
  }
};
async function start() {
  if (starting) return;
  starting = true;
  lastPose = null;
  draw(null);
  samples = [];
  get<HTMLButtonElement>("connect").disabled = true;
  get<HTMLButtonElement>("reconnect").disabled = true;
  await tracker.start();
  starting = false;
  get<HTMLButtonElement>("connect").disabled = false;
  get<HTMLButtonElement>("reconnect").disabled = false;
}
get("connect").onclick = () => void start();
get("reconnect").onclick = () => void start();
const stale = setInterval(() => {
  if (lastPose && performance.now() - received > 500) {
    lastPose = null;
    draw(null);
    get("vision-status").textContent = "Tracking paused · step into view";
  }
  if (!live) get("tracking-rate").textContent = "Waiting for camera";
}, 250);
window.addEventListener("pagehide", () => {
  clearInterval(stale);
  tracker.stop();
});
if (new URLSearchParams(location.search).has("autostart")) void start();
