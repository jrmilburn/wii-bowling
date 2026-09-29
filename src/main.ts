/* THESIS: A friendly bowling alley fills the screen and invites a real underarm throw.
OWN-WORLD: Polished maple, brushed metal, soft sea-green panels and clear sports lettering.
STORY: Choose a hand, enable the camera, calibrate, then play without touching the computer.
FIRST VIEWPORT: Alley behind a left setup sheet; unbranded controls above, privacy note below.
FORM: Full-screen playable 3D scene, reference-video shot sequence with realistic materials, recorded replay and character reaction. */
import "./style.css";
import { CameraTracker } from "./tracking/camera";
import { armSample, type Hand, type PoseFrame } from "./tracking/pose";
import { SwingDetector } from "./tracking/swing";
import { ScoreGame, rollMarks } from "./game/scoring";
import { initPhysics, type BowlingPhysics } from "./game/physics";
import { AlleyScene } from "./view/scene";
import { AlleyAudio } from "./view/audio";
import { TUNING } from "./config";
import { controlledThrow } from "./game/throw";
import { MotionAim } from "./tracking/aim";
import {
  drawTrackingOverlay,
  trackingIndicators,
} from "./view/trackingOverlay";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
$("app").innerHTML = `
 <div id="world" aria-label="Three-dimensional bowling alley"></div>
 <div class="vignette"></div>
 <header><div class="top-actions"><span id="local-label"></span><button id="settings-button" class="icon-button" aria-label="Open settings" aria-expanded="false">⚙</button><button id="exit" hidden>Leave game</button></div></header>
 <section id="welcome" class="welcome" aria-labelledby="welcome-title"><div class="ticket-label"><span></span> YOUR LANE IS OPEN</div><h1 id="welcome-title">Ready to<br><em>bowl?</em></h1><p class="welcome-copy">Ten pins. Ten frames.<br>Play with a natural swing of your arm.</p>
 <div class="how"><span class="motion-icon">↶</span><p><strong>Step back. Swing. Let it roll.</strong><br>Use a natural underarm swing. The ball releases automatically as your arm passes your side.</p></div>
 <fieldset><legend>I bowl with my</legend><div class="segmented"><label><input type="radio" name="hand" value="right" checked><span>Right hand</span></label><label><input type="radio" name="hand" value="left"><span>Left hand</span></label></div></fieldset>
 <fieldset><legend>Choose your game</legend><div class="segmented"><label><input type="radio" name="mode" value="game" checked><span>10-frame game</span></label><label><input type="radio" name="mode" value="practice"><span>Practice</span></label></div></fieldset>
 <button id="start" class="primary" disabled>Preparing your lane… <span>↗</span></button><p id="start-error" role="alert"></p><p class="privacy">◉ Camera stays on your device. Never recorded.</p>
 </section>
 <aside id="intro-note"><span class="lane-number">05</span><span>TEN FRAMES<br>ONE LANE</span></aside>
 <section id="play-hud" hidden><div class="session-label"><span id="game-mode">TEN-PIN BOWLING</span><strong id="frame-label">Frame 1 <small>/ 10</small></strong><span id="delivery-label">First delivery</span></div>
 <aside id="camera-panel"><div class="camera-header"><span class="live-dot"></span><span id="camera-label">YOUR SWING</span><button id="overlay-button" aria-pressed="true" aria-label="Toggle tracking overlay">Tracking on</button></div><div id="camera-image"><canvas id="overlay" width="640" height="480"></canvas><div id="camera-placeholder">Finding your camera…</div></div><div id="tracking-details"><div id="tracking-legend">Solid green: tracked · dashed amber: uncertain</div><div id="tracking-indicators"></div><div id="tracking-phase">Calibrating</div><div id="tracking-message">Waiting for body tracking…</div></div><div id="landmark-status">Shoulders · elbow · wrist · hips</div></aside>
 <div id="prompt" role="status" aria-live="polite"><span id="status-label">LET’S GET COMFORTABLE</span><h2 id="status">Stand back, arm relaxed</h2><p id="hint">Camera at waist height · turn 40–50° with your bowling side nearer the camera</p><div id="calibration-track"><div id="calibration-progress"></div></div></div>
 <div id="shot-caption" hidden aria-live="polite"></div><div id="result" hidden><span id="result-kicker">NICE ROLL</span><h2 id="result-title">Strike!</h2><p id="result-sub"></p></div>
 <footer id="score-bar"><div class="score-name"><span class="player-dot">✦</span><span>You<small id="pins-left">10 pins standing</small></span></div><div id="scorecard" aria-label="Scorecard"></div><div class="total"><span>TOTAL</span><strong id="total-score">0</strong></div></footer>
 <div id="aim-controls" aria-label="Aim your shot"><div class="aim-heading"><span>Aim</span><output id="aim-value" for="aim-angle">Center</output></div><div class="aim-inputs"><button id="aim-left" aria-label="Aim left">←</button><input id="aim-angle" type="range" min="-2.5" max="2.5" step="0.1" value="0" aria-label="Aim angle in degrees"><button id="aim-right" aria-label="Aim right">→</button><button id="aim-center">Center</button></div><p id="motion-aim-status">Raise your free hand to chest height to aim.</p><p class="aim-keyboard-hint">Or use ← → / A D · your swing sets the power</p></div>
 <button id="practice-reset" hidden>Fresh rack ↻</button>
 </section>
 <section id="final" hidden aria-labelledby="final-title"><div class="ticket-label">THAT’S A WRAP</div><h2 id="final-title">Nicely bowled.</h2><p>Your final score</p><strong id="final-score">0</strong><p id="final-summary"></p><button id="play-again" class="primary">Play again <span>↻</span></button><p class="hands-free-replay">Or raise both hands for two seconds.</p></section>
 <section id="settings" hidden aria-label="Settings"><div class="settings-title"><h2>Settings</h2><button id="settings-close" aria-label="Close settings">×</button></div><label>Sound effects<input id="sound" type="checkbox" checked></label><label>Clean recording mode<input id="record" type="checkbox"></label><label>Camera inset<input id="inset" type="checkbox" checked></label><label>Visual quality<select id="quality"><option value="high">High</option><option value="low">Light</option></select></label><label>Tracking frequency<select id="frequency"><option value="30">30 fps</option><option value="20">20 fps</option><option value="15">15 fps</option></select></label><button id="recalibrate">Recalibrate arm</button><p>Turn about 40–50° with your bowling shoulder nearer the camera. Keep your shoulders, hips and whole bowling arm in view. Your hand should visibly move across the preview as it swings behind your hip and forward. After turning, rest your arm until Ready to bowl. No run-up needed.</p></section>
 <div id="loading" role="status">Setting the pins…</div>
`;
let physics!: BowlingPhysics, view!: AlleyScene;
const camera = new CameraTracker(),
  swing = new SwingDetector(),
  audio = new AlleyAudio();
let game = new ScoreGame(),
  hand: Hand = "right",
  practice = false,
  playing = false,
  finished = false,
  overlay = true,
  disposed = false,
  raf = 0,
  lastTime = 0,
  nextAt = 0,
  lastPoseAt = 0,
  lastUi = 0,
  replayAt = 0,
  practiceRolls = 0;
let cameraMessage = "",
  freshAfter = false;
let latestPose: PoseFrame | null = null;
let aimDegrees = 0;
let shotVariation = true;
const motionAim = new MotionAim();
let motionAiming = false;
$("quality")
  .closest("label")!
  .insertAdjacentHTML(
    "beforebegin",
    '<label>Natural shot variation<input id="shot-variation" type="checkbox" checked></label><p class="variation-help">Adds a little release variation. Turn off for repeatable practice.</p>',
  );
$<HTMLInputElement>("shot-variation").onchange = (e) => {
  shotVariation = (e.target as HTMLInputElement).checked;
};
const aimControl = $<HTMLInputElement>("aim-angle");
const canAim = () => playing && !finished && !physics?.active && nextAt === 0;
function setAim(value: number, fromMotion = false) {
  if (!canAim()) return;
  if (!fromMotion) motionAim.reset();
  aimDegrees = Math.round(Math.max(-2.5, Math.min(2.5, value)) * 10) / 10;
  aimControl.value = String(aimDegrees);
  $("aim-value").textContent =
    aimDegrees === 0
      ? "Center"
      : `${Math.abs(aimDegrees).toFixed(1)}° ${aimDegrees < 0 ? "left" : "right"}`;
}
aimControl.oninput = () => setAim(Number(aimControl.value));
$("aim-left").onclick = () => setAim(aimDegrees - 0.1);
$("aim-right").onclick = () => setAim(aimDegrees + 0.1);
$("aim-center").onclick = () => setAim(0);
window.addEventListener("keydown", (e) => {
  if (
    !canAim() ||
    !$("settings").hidden ||
    (e.target instanceof HTMLElement &&
      e.target.matches("input,select,textarea,button"))
  )
    return;
  if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(e.key)) {
    e.preventDefault();
    setAim(aimDegrees + (["ArrowLeft", "a", "A"].includes(e.key) ? -0.1 : 0.1));
  }
});
let lastIndicators = "";
const video = camera.video;
video.setAttribute("aria-label", "Mirrored live camera preview");
$("camera-image").prepend(video);
const ctx = $<HTMLCanvasElement>("overlay").getContext("2d")!;
video.addEventListener("loadedmetadata", () => {
  ctx.canvas.width = video.videoWidth || 640;
  ctx.canvas.height = video.videoHeight || 480;
  $("camera-image").style.aspectRatio =
    `${ctx.canvas.width} / ${ctx.canvas.height}`;
});
function updateTrackingView() {
  const pose =
    performance.now() - lastPoseAt < TUNING.tracking.maxGapMs + 120
      ? latestPose
      : null;
  const indicators = trackingIndicators(
    pose,
    motionAiming ? (hand === "right" ? "left" : "right") : hand,
  );
  const html = indicators
    .map(
      ({ name, status }) =>
        `<span class="tracking-indicator" data-status="${status}"><b>${name}</b><span>${status}</span></span>`,
    )
    .join("");
  if (html !== lastIndicators) {
    $("tracking-indicators").innerHTML = html;
    lastIndicators = html;
  }
  $("camera-panel").dataset.tracking = pose?.image.length
    ? indicators.every((i) => i.status === "tracked")
      ? "tracked"
      : "uncertain"
    : "missing";
  const phases = {
    CALIBRATING: `Calibrating · ${Math.round(swing.progress * 100)}%`,
    READY: swing.armed ? "Ready to bowl" : "Waiting for ready pose",
    BACKSWING: "Backswing detected",
    FORWARD_SWING: "Forward swing detected",
    RELEASED: "Ball released",
    RESOLVING: "Ball in play",
  };
  $("tracking-phase").textContent = motionAiming
    ? "Motion aiming"
    : phases[swing.state];
  $("tracking-message").textContent = cameraMessage || swing.message;
  if (!pose && overlay) drawTrackingOverlay(ctx, null, hand);
}
$("frequency")
  .closest("label")!
  .insertAdjacentHTML(
    "afterend",
    '<label>Camera upside down<input id="camera-rotation" type="checkbox" aria-label="Rotate camera 180 degrees"></label>',
  );
const rotationControl = $<HTMLInputElement>("camera-rotation");
// The player's current setup has an inverted webcam; remember any later change.
let cameraUpsideDown = true;
try {
  cameraUpsideDown =
    (localStorage.getItem("camera-upside-down") ??
      localStorage.getItem("sunny-lanes.camera-upside-down")) !== "false";
} catch {
  /* Camera settings also work when browser storage is unavailable. */
}
rotationControl.checked = cameraUpsideDown;
camera.setUpsideDown(cameraUpsideDown);
rotationControl.onchange = () => {
  camera.setUpsideDown(rotationControl.checked);
  try {
    localStorage.setItem("camera-upside-down", String(rotationControl.checked));
  } catch {
    /* Optional persistence. */
  }
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  latestPose = null;
  swing.reset();
  replayAt = 0;
};
function score() {
  const frames = game.scorecard();
  $("scorecard").innerHTML = frames
    .map(
      (f, i) =>
        `<div class="frame ${i === game.index && !finished ? "current" : ""}" aria-label="Frame ${i + 1}: ${rollMarks(f.rolls, i === 9).join(", ") || "not bowled"}; score ${f.total ?? "pending"}"><span class="frame-number">${i + 1}</span><div class="rolls">${rollMarks(
          f.rolls,
          i === 9,
        )
          .map((m) => `<span>${m}</span>`)
          .join(
            "",
          )}</div><strong>${f.total ?? (f.complete ? "·" : "")}</strong></div>`,
    )
    .join("");
  $("total-score").textContent = String(game.total);
  $("frame-label").innerHTML = practice
    ? `Roll ${practiceRolls + 1}`
    : `Frame ${game.index + 1} <small>/ 10</small>`;
  $("game-mode").textContent = practice
    ? "PRACTICE · FIND YOUR RHYTHM"
    : "TEN-PIN BOWLING";
  $("delivery-label").textContent = practice
    ? "A fresh rack every time"
    : game.index === 9 && game.frames[9].length >= 2
      ? "Bonus delivery"
      : game.frames[game.index].length === 0
        ? "First delivery"
        : "Next delivery";
  $("pins-left").textContent =
    `${physics.pins.filter((pin) => !physics.isDown(pin)).length} pins standing`;
}
function showStatus() {
  if (!playing || finished) return;
  const state = swing.state;
  $("status-label").textContent =
    state === "CALIBRATING"
      ? "A MOMENT TO CALIBRATE"
      : swing.armed
        ? "YOUR LANE. YOUR MOMENT."
        : state === "READY"
          ? "GET COMFORTABLE"
          : state === "BACKSWING" || state === "FORWARD_SWING"
            ? "NICE AND EASY"
            : "LET IT ROLL";
  $("status").textContent = cameraMessage || swing.message;
  $("hint").textContent =
    state === "CALIBRATING"
      ? "Camera at waist height · turn 40–50° with your bowling side nearer the camera"
      : swing.armed
        ? `Swing your ${hand} hand behind your hip, then forward past your side.`
        : state === "READY"
          ? `Relax your ${hand} arm. Changed your stance? Recalibrate in Settings.`
          : "Follow through comfortably.";
  if (motionAiming) {
    $("status-label").textContent = "MOTION AIM";
    $("status").textContent = "Move your free hand left or right";
    $("hint").textContent =
      "Lower your free hand to lock the direction, then swing your bowling arm.";
  }
  $("calibration-track").hidden = state !== "CALIBRATING";
  $("calibration-progress").style.transform = `scaleX(${swing.progress})`;
  $("prompt").hidden =
    state === "RELEASED" || state === "RESOLVING" || nextAt > 0;
  $("landmark-status").textContent = swing.current?.valid
    ? "Shoulders, elbow, wrist & hips visible"
    : "Keep your arm and hips in view";
  $("camera-placeholder").hidden = video.readyState >= 2;
  $("camera-label").textContent = swing.current?.valid
    ? `${hand.toUpperCase()} ARM IN VIEW`
    : "FIND YOUR POSITION";
  if (motionAiming) {
    $("camera-label").textContent =
      `${hand === "right" ? "LEFT" : "RIGHT"} HAND AIMING`;
    $("landmark-status").textContent =
      "Move your free hand sideways · lower to lock";
  }
  view.aim(
    Math.max(
      -0.04,
      Math.min(
        0.04,
        (swing.current?.lateral ?? swing.lateralNeutral) - swing.lateralNeutral,
      ),
    ) *
      0.5 +
      (aimDegrees * Math.PI) / 180,
    canAim(),
  );
}
camera.onStatus = (message) => {
  cameraMessage = message === "Camera ready" ? "" : message;
  if (message === "Camera ready") {
    $("start").textContent = "Camera connected";
    $("welcome").hidden = true;
  } else if (!message.includes("…")) {
    swing.lost(message);
    $("welcome").hidden = false;
    $("welcome").classList.add("retry");
    $<HTMLButtonElement>("start").disabled = false;
    $("start").textContent = "Try camera again ↗";
    $("start-error").textContent = message;
  }
  showStatus();
};
camera.onPose = (p: PoseFrame) => {
  latestPose = p;
  lastPoseAt = performance.now();
  cameraMessage = "";
  if (finished) {
    const raised = [15, 16].every(
      (i, j) =>
        p.image[i] &&
        (p.image[i].visibility ?? 0) > 0.7 &&
        p.image[i].y < p.image[11 + j].y - 0.12,
    );
    if (raised) {
      replayAt ||= p.t;
      if (p.t - replayAt > 2000) restart();
    } else replayAt = 0;
  } else if (playing) {
    const sample = armSample(p, hand);
    const gesture = motionAim.step(
      p,
      hand,
      aimDegrees,
      canAim() && swing.state === "READY",
    );
    motionAiming = gesture.engaged;
    $("aim-controls").classList.toggle("motion-active", gesture.active);
    $("motion-aim-status").textContent = gesture.active
      ? "Move left / right · lower your hand to lock aim"
      : gesture.engaged
        ? "Hold your free hand at chest height…"
        : `Raise your ${hand === "right" ? "left" : "right"} hand to chest height to aim.`;
    if (gesture.angle !== undefined) setAim(gesture.angle, true);
    // Aiming and bowling are distinct gestures. Re-arm after the free hand drops.
    if (gesture.engaged)
      swing.lost(
        "Lower your free hand to lock aim, then relax your bowling arm",
      );
    const delivery = gesture.engaged ? null : swing.feed(sample);
    view.track(sample, swing.neutral);
    if (delivery && !physics.active && nextAt === 0) {
      motionAim.reset();
      motionAiming = false;
      physics.launch(controlledThrow(delivery, aimDegrees, shotVariation));
      view.release();
      audio.roll(true);
      swing.resolving();
      $("prompt").hidden = true;
    }
  }
  if (overlay)
    drawTrackingOverlay(
      ctx,
      p,
      motionAiming ? (hand === "right" ? "left" : "right") : hand,
    );
};
function restart() {
  motionAim.reset();
  motionAiming = false;
  game = new ScoreGame();
  finished = false;
  practiceRolls = 0;
  nextAt = 0;
  replayAt = 0;
  physics.active = false;
  physics.removeBall();
  physics.rack();
  swing.next();
  view.ready();
  $("final").hidden = true;
  $("result").hidden = true;
  score();
}
async function start() {
  // A disconnected camera can be restarted without erasing the current game.
  if (playing) {
    $<HTMLButtonElement>("start").disabled = true;
    $("start-error").textContent = "";
    $("welcome").hidden = true;
    if (!physics.active && !nextAt) swing.reset();
    await camera.start();
    return;
  }
  $<HTMLButtonElement>("start").disabled = true;
  $("start-error").textContent = "";
  hand = document.querySelector<HTMLInputElement>("input[name=hand]:checked")!
    .value as Hand;
  practice =
    document.querySelector<HTMLInputElement>("input[name=mode]:checked")!
      .value === "practice";
  view.setHand(hand);
  view.setPlaying(true);
  playing = true;
  finished = false;
  swing.reset();
  lastPoseAt = performance.now();
  $("welcome").hidden = true;
  $("intro-note").hidden = true;
  $("play-hud").hidden = false;
  $("exit").hidden = false;
  $("local-label").textContent = "Local camera · private play";
  $("practice-reset").hidden = !practice;
  $("scorecard").classList.toggle("practice-card", practice);
  restart();
  swing.reset();
  await audio.start().catch(() => {});
  await camera.start();
}
$("start").onclick = () => void start();
$("play-again").onclick = restart;
$("practice-reset").onclick = () => {
  if (!physics.active && practice) {
    physics.removeBall();
    physics.rack();
    nextAt = 0;
    swing.next();
    view.ready();
    $("result").hidden = true;
    score();
  }
};
$("overlay-button").onclick = () => {
  overlay = !overlay;
  $("overlay-button").setAttribute("aria-pressed", String(overlay));
  $("overlay-button").textContent = overlay ? "Tracking on" : "Tracking off";
  if (!overlay) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  else drawTrackingOverlay(ctx, latestPose, hand);
};
function settings(open: boolean) {
  $("settings").hidden = !open;
  $("settings-button").setAttribute("aria-expanded", String(open));
}
$("settings-button").onclick = () => settings($("settings").hidden);
$("settings-close").onclick = () => settings(false);
$<HTMLInputElement>("sound").onchange = (e) =>
  audio.setMuted(!(e.target as HTMLInputElement).checked);
$<HTMLInputElement>("record").onchange = (e) =>
  document.body.classList.toggle(
    "recording",
    (e.target as HTMLInputElement).checked,
  );
$<HTMLInputElement>("inset").onchange = (e) =>
  ($("camera-panel").hidden = !(e.target as HTMLInputElement).checked);
$<HTMLSelectElement>("quality").onchange = (e) =>
  view.quality((e.target as HTMLSelectElement).value === "high");
$<HTMLSelectElement>("frequency").onchange = (e) =>
  (camera.hz = Number((e.target as HTMLSelectElement).value));
$("recalibrate").onclick = () => {
  if (!physics.active && !nextAt) {
    swing.reset();
    settings(false);
  }
};
function resolve(pins: number, time: number) {
  audio.roll(false);
  let strike = pins === 10,
    spare = false;
  if (!practice) {
    const result = game.roll(pins);
    strike = result.strike;
    spare = result.spare;
    finished = result.finished;
    freshAfter = result.freshRack;
  }
  practiceRolls++;
  $("result").hidden = false;
  $("result-kicker").textContent = strike
    ? "ALL TEN. ALL YOURS."
    : spare
      ? "A CLEAN FINISH"
      : pins === 0
        ? "NEXT ONE’S YOURS"
        : "LOOKING GOOD";
  $("result-title").textContent = strike
    ? "Strike!"
    : spare
      ? "Spare!"
      : pins === 0
        ? "Keep rolling."
        : `${pins} pins!`;
  $("result-sub").textContent = finished
    ? "A game well played."
    : practice
      ? "A fresh rack is on its way."
      : "Take a breath. Your next ball is on its way.";
  audio.celebrate(strike || spare);
  view.result(strike || spare, time);
  nextAt = time + view.cutsceneDuration;
  score();
}
function next() {
  nextAt = 0;
  $("result").hidden = true;
  physics.clearFallen();
  if (finished) {
    $("final").hidden = false;
    $("prompt").hidden = true;
    $("final-score").textContent = String(game.total);
    const strikes = game.frames.flat().filter((r) => r === 10).length;
    $("final-summary").textContent =
      `10 frames · ${strikes} ${strikes === 1 ? "strike" : "strikes"} · one good time`;
    return;
  }
  if (practice || freshAfter) physics.rack();
  view.ready();
  swing.next();
  score();
}
function loop(t: number) {
  if (disposed) return;
  const dt = lastTime ? Math.min(0.1, (t - lastTime) / 1000) : 0;
  lastTime = t;
  const pins = physics.step(dt);
  if (pins !== null) resolve(pins, t);
  if (nextAt && t >= nextAt) next();
  if (
    playing &&
    t - lastPoseAt > TUNING.tracking.maxGapMs + 120 &&
    !physics.active &&
    !nextAt
  ) {
    motionAim.reset();
    motionAiming = false;
    $("aim-controls").classList.remove("motion-active");
    swing.lost(
      document.hidden
        ? "Return to the game · relax your arm"
        : "Arm not visible · step into view",
    );
    replayAt = 0;
  }
  if (t - lastUi > 120) {
    if (playing) updateTrackingView();
    showStatus();
    $<HTMLButtonElement>("practice-reset").disabled = physics.active;
    $<HTMLButtonElement>("recalibrate").disabled = physics.active || nextAt > 0;
    rotationControl.disabled = physics.active || nextAt > 0;
    $("aim-controls").hidden = !canAim();
    lastUi = t;
  }
  view.render(physics, t);
  const phase = view.shotPhase;
  document.body.dataset.shot = phase;
  const caption = $("shot-caption");
  caption.hidden = !["replay", "reaction"].includes(phase);
  caption.textContent = phase === "replay" ? "REPLAY · SLOW MOTION" : "";
  if (phase === "reaction") caption.hidden = true;
  raf = requestAnimationFrame(loop);
}
function dispose() {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(raf);
  camera.stop();
  audio.dispose();
  view?.dispose();
  physics?.dispose();
}
$("exit").onclick = () => {
  dispose();
  location.reload();
};
window.addEventListener("pagehide", dispose);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    swing.lost("Relax your arm when you return");
    lastPoseAt = 0;
    replayAt = 0;
  }
});
try {
  physics = await initPhysics();
  view = new AlleyScene($("world"));
  physics.onImpact = (s) => audio.impact(s);
  $("loading").hidden = true;
  $<HTMLButtonElement>("start").disabled = false;
  $("start").innerHTML = "Let’s bowl <span>↗</span>";
  score();
  raf = requestAnimationFrame(loop);
} catch (e) {
  $("loading").textContent =
    "The alley could not load. Enable WebGL2 and reload to try again.";
  console.error(e);
}
// Explicit development hook only; never exposed in production or used as webcam evidence.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("dev")) {
  Object.assign(window, {
    bowlingDev: {
      throw: (speed = 7, angle = 0) => {
        if (physics.active) return;
        playing = true;
        view.setPlaying(true);
        $("welcome").hidden = true;
        $("intro-note").hidden = true;
        $("play-hud").hidden = false;
        physics.launch({ speed, angle });
        view.release();
        swing.resolving();
      },
      view,
      physics,
      swing,
      game,
    },
  });
}
