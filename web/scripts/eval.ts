/**
 * Face-shape classifier evaluation harness.
 *
 * Runs the REAL production pipeline (MediaPipe Face Landmarker in headless
 * Chromium → lib/faceShape measure+classify) over a labeled dataset and
 * reports a confusion matrix, per-class precision/recall/F1 and macro-F1.
 *
 * Dataset layout (one folder per label, case-insensitive):
 *   <dir>/heart/*.jpg  <dir>/oblong/*  <dir>/oval/*  <dir>/round/*  <dir>/square/*
 *
 * Recommended open dataset: "Face Shape Dataset" (Niten Lama, Kaggle) —
 * ~5k celebrity images, 5 classes:
 *   kaggle datasets download -d nitenlama/face-shape-dataset
 *
 * Usage:
 *   npm run eval -- <dataset-dir> [--limit N]   # N images per class (default 100)
 *
 * Requires network access in the browser (MediaPipe WASM + model from CDN).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium } from "playwright";
import { classify, measure, type Landmark } from "../lib/faceShape";
import type { FaceShape } from "../lib/types";

const DATASET_CLASSES = ["heart", "oblong", "oval", "round", "square"] as const;
type DatasetClass = (typeof DATASET_CLASSES)[number];

const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function parseArgs() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) {
    console.error("usage: npm run eval -- <dataset-dir> [--limit N]");
    process.exit(1);
  }
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 100;
  return { dir, limit };
}

/** Restrict the 7-class membership to the dataset's 5 labels and argmax. */
function predictDatasetClass(landmarks: Landmark[]): DatasetClass {
  const result = classify(measure(landmarks));
  let best: DatasetClass = "oval";
  let bestScore = -1;
  for (const c of DATASET_CLASSES) {
    const m = result.membership[c as FaceShape] ?? 0;
    if (m > bestScore) {
      bestScore = m;
      best = c;
    }
  }
  return best;
}

async function main() {
  const { dir, limit } = parseArgs();

  // Collect labeled samples.
  const samples: { path: string; label: DatasetClass }[] = [];
  for (const entry of readdirSync(dir)) {
    const label = entry.toLowerCase() as DatasetClass;
    if (!DATASET_CLASSES.includes(label)) continue;
    const sub = join(dir, entry);
    if (!statSync(sub).isDirectory()) continue;
    const files = readdirSync(sub)
      .filter((f) => IMG_EXT.has(extname(f).toLowerCase()))
      .slice(0, limit);
    for (const f of files) samples.push({ path: join(sub, f), label });
  }
  if (samples.length === 0) {
    console.error(`no labeled images found under ${dir}`);
    process.exit(1);
  }
  console.log(`evaluating ${samples.length} images from ${dir}\n`);

  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {}
  );
  const page = await browser.newPage();

  // Load MediaPipe once inside the page.
  await page.setContent(`<html><body></body></html>`);
  await page.evaluate(async () => {
    const mod = await import(
      /* webpackIgnore: true */
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
    );
    const vision = await mod.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );
    // @ts-expect-error attach to window for reuse
    window.__landmarker = await mod.FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  });

  // Confusion matrix [actual][predicted].
  const cm: Record<DatasetClass, Record<DatasetClass, number>> = Object.fromEntries(
    DATASET_CLASSES.map((a) => [
      a,
      Object.fromEntries(DATASET_CLASSES.map((p) => [p, 0])),
    ])
  ) as never;
  let noFace = 0;
  let done = 0;

  for (const sample of samples) {
    const b64 = readFileSync(sample.path).toString("base64");
    const mime = extname(sample.path).toLowerCase() === ".png" ? "png" : "jpeg";
    const landmarks = (await page.evaluate(
      async ({ b64, mime }) => {
        const img = new Image();
        img.src = `data:image/${mime};base64,${b64}`;
        await img.decode();
        // @ts-expect-error set in the init evaluate
        const det = window.__landmarker.detect(img);
        if (!det.faceLandmarks.length) return null;
        // De-normalize into pixel space (same as the production PhotoStep).
        return det.faceLandmarks[0].map((p: { x: number; y: number; z: number }) => ({
          x: p.x * img.naturalWidth,
          y: p.y * img.naturalHeight,
          z: p.z * img.naturalWidth,
        }));
      },
      { b64, mime }
    )) as Landmark[] | null;

    if (!landmarks) {
      noFace++;
    } else {
      cm[sample.label][predictDatasetClass(landmarks)]++;
    }
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${samples.length}…`);
  }

  await browser.close();

  // Report.
  const pad = (s: string | number, n = 8) => String(s).padStart(n);
  console.log(`\nno-face-detected: ${noFace}\n`);
  console.log("confusion matrix (rows = actual, cols = predicted)");
  console.log(pad("") + DATASET_CLASSES.map((c) => pad(c)).join(""));
  for (const a of DATASET_CLASSES) {
    console.log(pad(a) + DATASET_CLASSES.map((p) => pad(cm[a][p])).join(""));
  }

  console.log("\nper-class metrics");
  let macroF1 = 0;
  for (const c of DATASET_CLASSES) {
    const tp = cm[c][c];
    const fn = DATASET_CLASSES.reduce((s, p) => s + (p === c ? 0 : cm[c][p]), 0);
    const fp = DATASET_CLASSES.reduce((s, a) => s + (a === c ? 0 : cm[a][c]), 0);
    const prec = tp + fp ? tp / (tp + fp) : 0;
    const rec = tp + fn ? tp / (tp + fn) : 0;
    const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
    macroF1 += f1 / DATASET_CLASSES.length;
    console.log(
      `  ${c.padEnd(8)} precision ${prec.toFixed(3)}  recall ${rec.toFixed(3)}  f1 ${f1.toFixed(3)}`
    );
  }
  console.log(`\nmacro-F1: ${macroF1.toFixed(3)}`);
}

void main();
