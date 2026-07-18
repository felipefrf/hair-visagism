"use client";

// Photo capture + on-device analysis. The image NEVER leaves the browser here:
// MediaPipe Face Landmarker runs via WASM and we only keep a data URL in
// memory for the (opt-in) try-on step later.

import { useCallback, useRef, useState } from "react";
import type { ShapeResult } from "@/lib/types";
import { classify, measure, MAX_POSE_DEVIATION_DEG } from "@/lib/faceShape";

interface Props {
  onAnalyzed: (result: ShapeResult, photoDataUrl: string) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string };

export default function PhotoStep({ onAnalyzed }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        setStatus({ kind: "loading", message: "Carregando modelo de análise…" });

        const { FaceLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
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

        const lm = detection.faceLandmarks[0];

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
        onAnalyzed(result, dataUrl);
      } catch (err) {
        console.error(err);
        setStatus({
          kind: "error",
          message:
            "Algo deu errado ao analisar a foto. Verifique sua conexão (o modelo é baixado na primeira vez) e tente novamente.",
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
