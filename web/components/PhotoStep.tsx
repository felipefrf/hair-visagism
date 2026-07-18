"use client";

// Photo capture + on-device analysis. The image NEVER leaves the browser here:
// MediaPipe Face Landmarker runs via WASM and we only keep a data URL in
// memory for the (opt-in) try-on step later.

import { useCallback, useRef, useState } from "react";
import type { ShapeResult } from "@/lib/types";
import {
  classify,
  measure,
  MEASUREMENT_LANDMARKS,
  MAX_POSE_DEVIATION_DEG,
  type Landmark,
} from "@/lib/faceShape";

interface Props {
  onAnalyzed: (
    result: ShapeResult,
    photoDataUrl: string,
    annotatedDataUrl: string
  ) => void;
  /** demo mode: skip the photo and continue with a sample analysis */
  onDemo?: () => void;
}

// Colors match the MeasurementPanel legend (Refined tokens).
export const MEASUREMENT_COLORS = {
  faceLength: "#3b82f6", // primary
  foreheadWidth: "#16a34a", // success
  cheekWidth: "#8b5cf6", // secondary
  jawWidth: "#d97706", // warning
} as const;

/** Draw the measurement lines used by the classifier over the photo. */
function annotate(img: HTMLImageElement, lm: Landmark[]): string {
  const maxW = 900;
  const scale = Math.min(1, maxW / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const line = (a: number, b: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, canvas.width / 300);
    ctx.beginPath();
    ctx.moveTo(lm[a].x * scale, lm[a].y * scale);
    ctx.lineTo(lm[b].x * scale, lm[b].y * scale);
    ctx.stroke();
    for (const i of [a, b]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lm[i].x * scale, lm[i].y * scale, ctx.lineWidth * 1.4, 0, 7);
      ctx.fill();
    }
  };

  for (const key of [
    "faceLength",
    "foreheadWidth",
    "cheekWidth",
    "jawWidth",
  ] as const) {
    for (const [a, b] of MEASUREMENT_LANDMARKS[key]) {
      line(a, b, MEASUREMENT_COLORS[key]);
    }
  }
  return canvas.toDataURL("image/jpeg", 0.85);
}

type Status =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string };

export default function PhotoStep({ onAnalyzed, onDemo }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        setStatus({ kind: "loading", message: "Carregando modelo de análise…" });

        const { FaceLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );
        // Self-hosted runtime (see scripts/prepare-assets.mjs): guarantees the
        // WASM matches the npm JS version and keeps analysis fully first-party.
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
          },
          runningMode: "IMAGE",
          numFaces: 1,
        });

        setStatus({ kind: "loading", message: "Analisando proporções…" });

        const dataUrl = await fileToDataUrl(file);
        const img = await loadImage(dataUrl);
        const detection = landmarker.detect(img);
        landmarker.close();

        if (!detection.faceLandmarks.length) {
          setStatus({
            kind: "error",
            message:
              "Não encontramos um rosto na foto. Tente uma foto de frente, com boa luz e sem óculos escuros.",
          });
          return;
        }

        // MediaPipe returns coordinates normalized by image width/height —
        // de-normalize into a common pixel space or portrait photos squash
        // the face length and break every ratio.
        const lm = detection.faceLandmarks[0].map((p) => ({
          x: p.x * img.naturalWidth,
          y: p.y * img.naturalHeight,
          z: p.z * img.naturalWidth,
        }));

        // Pose gating: compare nose-to-cheek distances left vs right — a
        // turned head breaks the width ratios.
        const nose = lm[1];
        const dL = Math.hypot(nose.x - lm[234].x, nose.y - lm[234].y);
        const dR = Math.hypot(nose.x - lm[454].x, nose.y - lm[454].y);
        const asym = Math.abs(dL - dR) / (dL + dR);
        const poseDeg = asym * 90;

        if (poseDeg > MAX_POSE_DEVIATION_DEG) {
          setStatus({
            kind: "error",
            message:
              "Seu rosto parece estar de lado na foto. Olhe direto para a câmera e tente de novo — as medidas dependem disso.",
          });
          return;
        }

        const result = classify(measure(lm, poseDeg));
        onAnalyzed(result, dataUrl, annotate(img, lm));
      } catch (err) {
        console.error(err);
        const detail = err instanceof Error ? err.message : String(err);
        setStatus({
          kind: "error",
          message: `Algo deu errado ao analisar a foto — tente novamente. (detalhe técnico: ${detail.slice(0, 160)})`,
        });
      }
    },
    [onAnalyzed]
  );

  return (
    <div className="text-center">
      <h2 className="text-3xl font-semibold mb-3">Envie uma foto de frente</h2>
      <p className="text-muted max-w-md mx-auto mb-8">
        Boa luz, cabelo afastado do rosto, olhando para a câmera. A análise
        roda no seu aparelho — <strong>a foto não é enviada</strong> para
        nenhum servidor nesta etapa.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {status.kind === "loading" ? (
        <p className="font-mono text-sm text-primary animate-pulse">
          {status.message}
        </p>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="bg-ink text-white font-mono text-sm px-8 py-3 rounded-lg hover:bg-primary transition-colors"
        >
          Tirar ou escolher foto
        </button>
      )}

      {status.kind === "error" && (
        <p className="mt-6 text-sm text-danger max-w-md mx-auto">
          {status.message}
        </p>
      )}

      {onDemo && status.kind !== "loading" && (
        <p className="mt-8">
          <button
            onClick={onDemo}
            className="font-mono text-xs uppercase tracking-widest text-muted underline underline-offset-4 hover:text-ink"
          >
            ou explore uma demo sem foto →
          </button>
        </p>
      )}
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
