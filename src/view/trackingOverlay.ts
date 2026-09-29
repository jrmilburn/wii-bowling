import type { Hand, Landmark, PoseFrame } from "../tracking/pose";
import { TUNING } from "../config";
export type LandmarkStatus = "tracked" | "uncertain" | "missing";
export function landmarkStatus(point: Landmark | undefined): LandmarkStatus {
  if (
    !point ||
    !Number.isFinite(point.x + point.y) ||
    point.x < 0.035 ||
    point.x > 0.965 ||
    point.y < 0.025 ||
    point.y > 0.975
  )
    return "missing";
  return (point.visibility ?? 0) >= TUNING.tracking.confidence
    ? "tracked"
    : "uncertain";
}
export function trackingIndicators(pose: PoseFrame | null, hand: Hand) {
  const shoulder = hand === "right" ? 12 : 11;
  return [
    { name: "Shoulders", ids: [11, 12] },
    { name: "Elbow", ids: [shoulder + 2] },
    { name: "Wrist", ids: [shoulder + 4] },
    { name: "Hips", ids: [23, 24] },
  ].map(({ name, ids }) => {
    const states = ids.map((id) => landmarkStatus(pose?.image[id]));
    const status: LandmarkStatus = states.includes("missing")
      ? "missing"
      : states.includes("uncertain")
        ? "uncertain"
        : "tracked";
    return { name, status };
  });
}
export function drawTrackingOverlay(
  ctx: CanvasRenderingContext2D,
  pose: PoseFrame | null,
  hand: Hand,
) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!pose?.image.length) {
    ctx.font = `bold ${w * 0.033}px Trebuchet MS`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#153b42dd";
    ctx.fillRect(w * 0.15, h * 0.43, w * 0.7, h * 0.14);
    ctx.fillStyle = "#fff8e6";
    ctx.fillText("No body tracked — step into view", w / 2, h * 0.515);
    return;
  }
  const selected = hand === "right" ? 12 : 11;
  // Mirror coordinates, not the canvas: labels stay readable on the mirrored video.
  const xy = (p: Landmark) => ({
    x: Math.max(8, Math.min(w - 8, (1 - p.x) * w)),
    y: Math.max(8, Math.min(h - 8, p.y * h)),
  });
  const good = (id: number) => landmarkStatus(pose.image[id]) === "tracked";
  ctx.lineCap = "round";
  for (const [a, b] of [
    [11, 12],
    [11, 23],
    [12, 24],
    [23, 24],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
  ]) {
    const pa = pose.image[a],
      pb = pose.image[b];
    if (!pa || !pb || !Number.isFinite(pa.x + pa.y + pb.x + pb.y)) continue;
    const arm = a === selected || a === selected + 2;
    const reliable = good(a) && good(b);
    const x = xy(pa),
      y = xy(pb);
    ctx.setLineDash(reliable ? [] : [8, 8]);
    ctx.strokeStyle = reliable ? (arm ? "#71ffb0" : "#ffffffbb") : "#ffba52";
    ctx.lineWidth = arm ? 7 : 3;
    ctx.shadowColor = "#082629";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(x.x, x.y);
    ctx.lineTo(y.x, y.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  for (const id of [11, 12, 13, 14, 15, 16, 23, 24]) {
    const p = pose.image[id];
    if (!p || !Number.isFinite(p.x + p.y)) continue;
    const pos = xy(p);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, id === selected + 4 ? 10 : 7, 0, Math.PI * 2);
    ctx.fillStyle = good(id) ? "#71ffb0" : "#ffba52";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#123e42";
    ctx.stroke();
  }
  ctx.textAlign = "left";
  ctx.font = `bold ${Math.max(15, w * 0.025)}px Trebuchet MS`;
  for (const [id, label] of [
    [selected, "Shoulder"],
    [selected + 2, "Elbow"],
    [selected + 4, `${hand === "right" ? "Right" : "Left"} wrist`],
  ] as const) {
    const p = pose.image[id];
    if (!p || !Number.isFinite(p.x + p.y)) continue;
    const pos = xy(p);
    const labelWidth = ctx.measureText(label).width + 14,
      x = Math.min(w - labelWidth - 4, Math.max(4, pos.x + 14)),
      y = Math.max(25, pos.y - 9);
    ctx.fillStyle = "#123e42e8";
    ctx.fillRect(x, y - 20, labelWidth, 27);
    ctx.fillStyle = good(id) ? "#adffce" : "#ffd28c";
    ctx.fillText(label, x + 7, y);
  }
}
