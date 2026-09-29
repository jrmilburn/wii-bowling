# Verification

## Automated checks completed

- 38 tests pass (`npm test`): correct scoring, bonus racks, both-handed timestamped image landmark sequences, bounded forward preparation, swing cancellations/one-shot release, stance-change rearming, tracking-overlay visibility classification, recorded-marker regression at 15/20/30 Hz, physical pin stability, impact at minimum/maximum arcade speeds, gutter resolution and standing-pin preservation.
- TypeScript passes (`npm run typecheck`).
- Production build succeeds (`npm run build`). The build reports the large physics/rendering bundle; it includes Rapier's WASM.
- Desktop (1440×900) and mobile (390×844) browser screenshots inspected.
- Browser startup loads the local MediaPipe model and performs inference on Chromium's **fake camera** without page/console errors.
- Two developer-simulated physical deliveries score, preserve remaining pins for delivery two, then automatically advance to a fresh rack in frame two.
- Simulated permission denial, missing/busy camera, camera disconnection/retry, and page-exit track/renderer disposal pass.
- Dependency installation audit reports zero known vulnerabilities.
- Production browser smoke passes: local model inference starts, all observed requests remain on the local origin, and `?dev` does not expose the development simulation hook.

Browser scripts use installed Microsoft Edge. Set `BOWLING_URL` to the running local server if it differs from their default. Screenshots and the browser report are generated in `.tmp/` and are not runtime assets.

## Human acceptance still required

The automated inputs above are **not real webcam motion validation**. A person should test:

1. Real calibration and repeated natural throws, both right- and left-handed, at about 40–50° to the camera with the bowling shoulder nearer the camera.
2. Small/large and slow/fast swings, varied body sizes, clothing, lighting and camera heights.
3. Arm occlusion, waving, adjusting clothes and returning from follow-through: no unintended release; reacquisition requires stable ready.
4. A complete ten-frame game without interacting with the computer between deliveries, including tenth-frame bonuses and raised-hands replay.
5. Actual camera unplug/replug and permissions, and performance on the intended filming device.

The next tuning decisions should be driven by those observations. Do not relax confidence/sequence gating to hide a poor camera angle.

## User recording review (29 September 2026)

Reviewed the supplied 36.5-second screen recording. The preview is upright and calibration reaches Ready around six seconds. Several attempts revert to an unarmed ready pose without releasing; the body remains visible for most of the clip. A local replay re-estimated landmarks from the small, mirrored camera inset (not the original camera stream): it reproduced no detected backswing and showed the low-ready height condition cancelling forward preparation. These lower-resolution estimates support diagnosis but do not establish the exact original live landmark values.

The detector now allows bounded forward preparation before a required backswing and reports low-arm, lateral-path, timeout and reversal cancellations separately. Setup instructions now specify the bowling shoulder nearer the camera at roughly 40–50°, rather than the earlier near-frontal/shoulder-away instruction. Real throws using that corrected setup remain to be tested; the recording is not being relabelled as successful gameplay.

## Second recording and control fix (29 September 2026)

Reviewed the supplied 50.6-second `wii bowling 2.mp4` locally. The enlarged
preview shows tracked arm landmarks through repeated attempts while the game
remains in an unarmed ready state with an old positioning message. A gradual
backswing and pause around 7–8 seconds also fails to trigger the old detector.

Changes:

- Swing recognition uses visible wrist travel relative to the hip, normalized
  by torso height and camera aspect ratio. Noisy world-depth estimates no
  longer decide whether a backswing or release happened. World coordinates
  only contribute a bounded, gently smoothed aiming adjustment.
- A relaxed, still arm refreshes the ready baseline after a stance change or
  tracking loss. Reacquisition itself cannot launch; the stable ready window
  is still required. Status text updates instead of retaining old warnings.
- A backswing can pause before moving forward. Backward excursion, minimum
  backswing time, forward speed, travel and low release height are required;
  backward speed at the deepest point is no longer an additional gate.
- Release occurs at the calibrated resting line. Thresholds accommodate the
  visible small swing without depending on a particular inference frame.

Verification performed on this change:

- Recovered the visible green marker centres from the first clear swing into
  a numeric regression fixture. Original confidence values and world points
  are unavailable. Missing/unrecoverable marker frames are omitted with their
  timestamp gaps preserved. The updated detector releases once at 8.4 seconds.
- Resampling that fixture at 15, 20 and 30 Hz with different frame offsets
  also produces one release near the same point.
- `node scripts/browser-recorded-swing.mjs` substitutes these markers for
  worker results in the production browser. It triggers a physical delivery,
  four fallen pins, scoring, and automatic return for the second delivery.
  This checks integration; it does not test live MediaPipe accuracy.
- All 38 tests, TypeScript and production build pass. Production MediaPipe
  startup with a fake camera and synthetic 180-degree rotation checks pass.

The actual recording remains unsuccessful gameplay. These fixes have not yet
been accepted in a new live-camera game by the player. The rest of the recording
has not been established as a successful sequence of deliveries. The source
video, extracted pictures and exploratory replay data remain local in `.tmp/`;
only numeric marker coordinates are included in the regression fixture.

## Graphics, camera and motion aiming update (2026-09-29)

- Removed the displayed app name, browser title and venue wordmark. Improved character detail and articulation, materials, reflections and pinsetter depth; added four seated spectators.
- Delivery camera follows continuously from the aiming view. Replay and character reaction run only after resolution. Replay interpolates recorded transforms and never changes scoring.
- Separate full-screen tracking page runs at http://127.0.0.1:5176/vision.html. Optional segmentation is requested only by that page; game inference retains its previous workload.
- A raised non-bowling hand engages aiming after calibration; sideways movement adjusts direction and lowering locks it. Manual aiming and bounded per-shot randomness are also available. Desktop camera inset is 420 px wide.
- Build and 46 automated tests pass. Tests cover gesture reliability, torso translation, handedness, stale frames, variation bounds, replay interpolation and existing physics/scoring/swing rules.
- Browser checks verify continuous camera movement, post-resolution replay, next-delivery rack state, mobile layout, independent tracking startup, orientation and full-screen controls. Motion-aim browser fixture reaches 1.5 degrees, locks on lowering, never launches a ball while aiming and verifies manual controls and camera width.
- Camera and gesture integration checks use synthetic video/landmarks. A segmentation pipeline check also used recorded gameplay and detected its avatar; this is not evidence of live human segmentation quality. Live webcam aiming and outline quality require player verification.
- Automatic policy review blocked launching Edge full-screen from the shell; the browser-control provider exposes no browsers. Both servers are running and links were provided for manual opening.
