// Adapted from Mario Kart's scripts/copy-mediapipe.mjs; same self-hosted WASM layout.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { buildSync } from "esbuild";
mkdirSync("public/mediapipe/wasm", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/wasm", {
  recursive: true,
});
// MediaPipe uses importScripts for its WASM loader. Bundle a classic worker;
// ES module workers cache loader imports and break GPU-to-CPU retry.
buildSync({
  entryPoints: ["src/tracking/pose.worker.ts"],
  bundle: true,
  format: "iife",
  outfile: "public/mediapipe/pose-worker.js",
  minify: true,
  target: "es2022",
});
const dest = "public/mediapipe/pose_landmarker_lite.task";
if (!existsSync(dest)) {
  console.log("Downloading MediaPipe Pose Landmarker Lite (first setup only)…");
  const r = await fetch(
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  );
  if (!r.ok) throw new Error(`Model download failed: ${r.status}`);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}
