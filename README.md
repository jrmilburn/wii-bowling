# Motion-controlled bowling

A local, single-player browser bowling game controlled with an empty-handed underarm swing. Original procedural visuals, Three.js rendering, MediaPipe Pose Landmarker and Rapier rigid-body physics.

## Run

Use Node.js 22.12+ (Node 24 recommended):

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://127.0.0.1:5173). Choose your bowling hand and game/practice mode, then **Let’s bowl**. Allow camera access. A desktop Chrome or Edge browser with a webcam and WebGL2 is the primary target. Other browsers need manual compatibility testing.

The first `predev` / `prebuild` downloads the official Pose Landmarker Lite model (~6 MB). The model, WASM runtime and classic inference worker are then served from this app's own origin. Camera frames are processed in a local worker, never sent to a server, recorded or stored. After model setup, gameplay has no external service dependency. HTTPS is required when hosted anywhere except localhost. Serve the entire `dist` directory, including `mediapipe`, at the site root.

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

## Camera and calibration

Aim hands-free after calibration: raise your **non-bowling hand** to chest height, hold briefly, move it left/right, then lower it to lock the direction. Keep that hand visible. Aiming cancels swing detection until the hand is lowered and the bowling arm is relaxed again. You can also use the aim slider, arrow buttons or A/D keys. Your bowling swing sets power. **Settings → Natural shot variation** adds small per-release direction (at most about 0.14°) and speed (at most 1.5%) variation; turn it off for repeatable practice. Shots and replays always use the actual physical result.

For a separate full-screen body-tracking view, run `npm run dev:vision` and open `http://127.0.0.1:5176/vision.html`. Start the camera and press **Full screen**. This page shows a mirrored silhouette outline from MediaPipe segmentation plus all 33 body landmarks, including hands, knees and feet. Toggle video/joints independently and use **Rotate 180°** for the inverted webcam. Its camera stream runs independently of the game; if the webcam reports busy, close the other camera view first.

The game remains unnamed. Deliveries use one continuous camera move from the original aiming view, following the ball into the pins without an angle cut. After the delivery resolves, a slow-motion replay shows the recorded ball/pin transforms, followed by the bowler's reaction and automatic next delivery. Reduced-motion settings omit these extra cuts. The character's release begins at its tracked pose and eases through follow-through and recovery.

For an upside-down mounted webcam, **Settings → Camera upside down** rotates the camera by 180° before MediaPipe inference, and corrects the mirrored preview. It is enabled by default for the current setup and remembers your choice. Changing it cancels the current swing and restarts calibration; the switch is unavailable while a ball is resolving. The tracking overlay stays aligned with the corrected picture.

1. Position the camera at roughly waist height, level and stationary, with good even lighting. Begin about 2–3 metres away; adjust for the camera's field of view.
2. Keep your head, both shoulders, hips and entire bowling arm visible, ideally with the frame reaching below your knees. Turn about 40–50° from facing the camera, with your **bowling shoulder nearer the camera**. The hand must visibly travel across the preview when it passes behind your hip and forward. Avoid a straight-on view (too little visible swing travel) or fully side-on view (the far shoulder can disappear). After changing stance, relax your arm until **Ready to bowl**; the resting position now refreshes automatically.
3. Relax your selected arm at your side with the elbow mostly straight. Hold still until the calibration bar fills (2.2 seconds), then continue resting briefly until **Ready**.
4. Move your hand behind your hip, then swing it smoothly forward beside your body, keeping the arm long and low. A modest forward preparation is allowed, but it never releases the ball: a backswing is still required. The ball releases automatically just past the calibrated resting position. Do not open a fist or make any special hand gesture. No run-up is needed.
5. Watch the delivery. The score, pin clearing and camera return happen automatically. Rest your arm at your side until ready for the next delivery.

Visible wrist travel relative to the hip controls swing recognition and arcade power, normalized by torso size. A pause at the back is allowed. Optional smoothed world-space lateral motion gives only a small, bounded direction change; unreliable depth does not gate release. There is no wrist-twist spin. The guide shows the general pre-throw heading, not a guaranteed impact path. Left/right hand is anatomical, not mirrored screen-left/screen-right.

If the arm disappears, moves implausibly or tracking stalls, any unreleased swing is cancelled. Reacquisition cannot throw: a stable, low ready position is required again. “Step back” means a required landmark is near the image edge. The enlarged camera preview has its tracking overlay on by default: green points/solid lines indicate visible landmarks, amber/dashed lines indicate uncertain predictions. The selected arm has a thicker line and readable shoulder, elbow and wrist labels. Visibility badges and the live swing stage below the preview distinguish landmark detection from swing recognition. Lost/stale tracking clears the skeleton instead of leaving old markers visible. Use **Tracking on/off** in the preview to toggle the overlay; clean recording mode hides the diagnostics. Calibration can be repeated in settings between deliveries.

Practice automatically provides a full rack after every roll; **Fresh rack** is an optional quick reset. After a ten-frame game, raise both hands above your shoulders for two seconds to play again hands-free, or use the replay button. Settings offer sound, 15/20/30 Hz tracking, lighter rendering, recording mode and an optional camera inset. Recording mode only changes presentation; the game does not record video.

## Mario Kart reuse

Inspected the actual neighbouring `../mario-kart` project before implementation. Its `src/game/hands/HandTracker.ts` uses `@mediapipe/tasks-vision` **1.0.1**, local WASM/model assets, 640×480 camera constraints, duplicate video-frame suppression, timestamps and GPU/CPU fallback. `Calibration.ts` uses a timed stable window and median calibration. `gestures.ts` provides time-independent exponential smoothing.

Bowling retains that MediaPipe version and camera/model lifecycle pattern, reuses `emaStep` verbatim, adapts median/stable-window calibration to a relaxed bowling arm, and extends the stack with PoseLandmarker. Its shoulder, elbow, wrist and hip image landmarks support swing recognition; world landmarks provide optional gentle aiming. Inference runs in a classic worker rather than Mario Kart's main-thread hand loop, so physics/rendering need not wait for inference. At most one frame is in flight. This is a separate project: **no files in Mario Kart were modified**. No attempt was made to refactor or replace its steering controls.

## Modules and tuning

- `src/tracking/camera.ts`, `pose.worker.ts`: camera permission, video lifecycle, local model loading and serialized inference.
- `src/tracking/pose.ts`: landmark validation, anatomical body-relative coordinates, torso normalization.
- `src/tracking/swing.ts`: timestamped calibration and `CALIBRATING → READY → BACKSWING → FORWARD_SWING → RELEASED → RESOLVING → READY` recognition. Cancellation returns to an unarmed ready state.
- `src/game/throw.ts`: bounded power and direction.
- `src/game/physics.ts`: 120 Hz fixed-step Rapier simulation, ball CCD, compound pin colliders, physical pinfall, gutters and settlement timeout. Standing pins retain their actual transforms on the second delivery.
- `src/game/scoring.ts`: independent ten-frame rules and pending bonuses, including tenth-frame rack rules.
- `src/view`: procedural alley, avatar, cameras, reflection and synthesized Web Audio effects.
- `src/main.ts`: session orchestration and event/throttled HUD updates.
- **`src/config.ts`**: tracking confidence, smoothing, calibration, swing/release thresholds, arcade throw limits and simulation settings.

The classic worker is bundled by `scripts/assets.mjs` because MediaPipe's WASM loader requires classic `importScripts` semantics; a module worker breaks its factory loading/fallback. Rerun `npm run dev` after changing the worker source. Quit with **Leave game**: tracks stop, the worker terminates (releasing its model/WASM context), audio closes, and physics and rendering resources dispose. `pagehide` performs the same cleanup.

## Verification and limitations

Automated tests cover gutter/perfect/spare/mixed games, pending and consecutive-strike bonuses, tenth-frame bonuses and invalid rolls; calibrated swing sequences, idle/lateral/forward-only motion, tracking loss, timestamp gaps and duplicate-release gating; stable physical racks, ball impacts, preservation of standing pins and gutters.

`scripts/browser-check.mjs` uses Playwright and installed Edge for desktop/mobile screenshots, fake-camera model startup and a developer-simulated physical delivery. It is **not evidence of real-world swing accuracy**. `?dev` exposes a simulation hook only in a development build; it is absent from production. There is no keyboard or button throw control in the player interface.

Still requires human webcam acceptance testing: both hands, different body proportions, clothing and lighting, slightly angled stances, fast/slow swings, occlusion, camera unplugging, permission changes, and playing all ten frames without touching the computer. Single-camera depth estimates are noisy. Backswings hidden behind the torso may cancel; repositioning the camera/body is preferable to weakening confidence gates. The control mapping is calibrated arcade input, not a measurement of a real bowling throw. GPU/CPU performance and browser compatibility vary; lower render quality or tracking frequency if needed. Model and physics WASM add several MB to initial loading.

## Sources

- [MediaPipe Pose Landmarker for web](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
- [Rapier continuous collision detection](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/)

The lane, avatar, textures, sounds and signage are procedural originals; no Nintendo branding or extracted game assets are included.
