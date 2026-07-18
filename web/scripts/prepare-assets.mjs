// Self-host MediaPipe runtime assets so the JS bundle and WASM are ALWAYS the
// same version (npm package) and the analysis has zero external dependencies
// at runtime. Runs automatically via predev/prebuild.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const wasmSrc = join(root, "node_modules/@mediapipe/tasks-vision/wasm");
const wasmDst = join(root, "public/mediapipe/wasm");
const modelDst = join(root, "public/models/face_landmarker.task");
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

cpSync(wasmSrc, wasmDst, { recursive: true });
console.log("prepare-assets: wasm copied to public/mediapipe/wasm");

if (!existsSync(modelDst)) {
  console.log("prepare-assets: downloading face_landmarker.task…");
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  mkdirSync(dirname(modelDst), { recursive: true });
  writeFileSync(modelDst, Buffer.from(await res.arrayBuffer()));
  console.log("prepare-assets: model saved to public/models");
} else {
  console.log("prepare-assets: model already present");
}
