# Motion-controlled bowling
## Platform
Web, desktop webcam and WebGL2. Single-player local play.
## Purpose
Play ten-pin bowling using an empty-handed, natural underarm swing. Initial setup clicks are acceptable; all deliveries progress automatically.
## Constraints
MediaPipe local inference, original procedural assets, correct ten-frame scoring and physical pin collisions. Keep the neighbouring Mario Kart project intact. Practice and recording modes. References supplied by the user establish a warm bowling alley with wood, teal panels and bright score graphics.
## Evidence
Mario Kart inspected at ../mario-kart: src/game/hands/HandTracker.ts, Calibration.ts, gestures.ts and scripts/copy-mediapipe.mjs. Real webcam reliability must be evaluated by a human; synthetic tests cannot establish it.
