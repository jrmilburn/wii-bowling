/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
let model: PoseLandmarker | null = null;
self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const files = await FilesetResolver.forVisionTasks(
        m.base + "/mediapipe/wasm",
      );
      const options = {
        baseOptions: {
          modelAssetPath: m.base + "/mediapipe/pose_landmarker_lite.task",
          delegate: "GPU" as "GPU" | "CPU",
        },
        runningMode: "VIDEO" as const,
        numPoses: 1,
        outputSegmentationMasks: !!m.silhouette,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      };
      try {
        model = await PoseLandmarker.createFromOptions(files, options);
      } catch (error) {
        console.warn("GPU pose inference unavailable; using CPU", error);
        options.baseOptions.delegate = "CPU";
        model = await PoseLandmarker.createFromOptions(files, options);
      }
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({ type: "error", message: String(error) });
    }
  } else if (m.type === "frame") {
    try {
      if (!model) throw new Error("Model is not ready");
      const result = model.detectForVideo(m.bitmap, m.t);
      const mask = result.segmentationMasks?.[0];
      const silhouette = mask
        ? {
            width: mask.width,
            height: mask.height,
            pixels: Uint8Array.from(mask.getAsFloat32Array(), (v) =>
              Math.round(v * 255),
            ),
          }
        : undefined;
      self.postMessage(
        {
          type: "pose",
          t: m.t,
          orientationVersion: m.orientationVersion,
          aspect: m.bitmap.width / m.bitmap.height,
          world: result.worldLandmarks[0] ?? [],
          image: result.landmarks[0] ?? [],
          silhouette,
        },
        silhouette ? [silhouette.pixels.buffer] : [],
      );
      result.close();
    } catch (error) {
      self.postMessage({ type: "error", message: String(error) });
    } finally {
      m.bitmap.close();
    }
  }
};
