# Visagia — web app

Next.js PWA: on-device face analysis (MediaPipe Face Landmarker, 478 pts),
visagism recommendation engine, and generative try-on.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

- `/` — landing
- `/analise` — the 4-step flow (foto → cabelo → projeção → resultado).
  The photo step has a **"demo sem foto"** link to test the whole flow without
  a camera (try-on disabled in demo mode).

Generative try-on needs `FAL_KEY` (fal.ai) — copy `.env.example` to
`.env.local`. Without it the API returns a graceful 503.

## Face-shape accuracy (F1) evaluation

We detect 478 landmarks and derive measurements from ~30 of them (averaged
multi-point widths + gonial-angle jaw analysis + yaw correction — see
`lib/faceShape.ts` `MEASUREMENT_LANDMARKS`).

To measure classifier quality against a labeled dataset:

1. Download the open [Face Shape Dataset (Niten Lama, Kaggle)](https://www.kaggle.com/datasets/niten19/face-shape-dataset)
   (~5k images, 5 classes: heart/oblong/oval/round/square):
   ```bash
   kaggle datasets download -d nitenlama/face-shape-dataset && unzip face-shape-dataset.zip
   ```
2. Run the harness (uses the REAL browser pipeline via headless Chromium):
   ```bash
   npm run eval -- ./FaceShape\ Dataset/testing_set --limit 100
   ```
3. It prints the confusion matrix, per-class precision/recall/F1 and macro-F1.
   Use it to tune `PROTOTYPES`/`WEIGHTS` in `lib/faceShape.ts`, or to train a
   small model on the ratio features (next step once baseline is known).

Caveats: the dataset is celebrity-photo, female-skewed, with occasional
occlusion — treat macro-F1 trends (before vs. after a change) as the signal,
not the absolute number.

## Structure

- `lib/faceShape.ts` — measurements, yaw correction, soft-membership classifier
- `lib/catalog.ts` — styles as attribute vectors (silhouette, line language, texture, archetypes)
- `lib/engine.ts` — scoring: harmony × personality × feasibility − hard rules, with PT-BR explanations
- `components/` — wizard steps
- `app/api/tryon/route.ts` — FLUX.1 Kontext render endpoint
- `scripts/eval.ts` — F1 evaluation harness
