"use client";

import { useState } from "react";
import type { ScoredStyle, ShapeResult } from "@/lib/types";
import { SHAPE_GOALS_PT, SHAPE_LABELS_PT } from "@/lib/faceShape";
import TryOn from "./TryOn";

interface Props {
  face: ShapeResult;
  results: ScoredStyle[];
  photoDataUrl: string;
}

export default function Results({ face, results, photoDataUrl }: Props) {
  const [tryOnStyle, setTryOnStyle] = useState<ScoredStyle | null>(null);
  const secondaryRelevant = face.membership[face.secondary] > 0.2;

  return (
    <div>
      <div className="text-center mb-12">
        <span className="kicker block mb-3">Sua análise</span>
        <h2 className="text-3xl font-semibold mb-3">
          Rosto {SHAPE_LABELS_PT[face.primary].toLowerCase()}
          {secondaryRelevant && (
            <>
              {" "}
              <span className="text-muted font-normal">
                puxado para {SHAPE_LABELS_PT[face.secondary].toLowerCase()}
              </span>
            </>
          )}
        </h2>
        <p className="text-muted max-w-lg mx-auto">
          {SHAPE_GOALS_PT[face.primary]}
        </p>
        <p className="font-mono text-xs text-muted mt-3">
          confiança {(face.confidence * 100).toFixed(0)}% · proporção
          comprimento/largura {face.ratios.r.toFixed(2)}
        </p>
      </div>

      <ol className="space-y-6">
        {results.map((r, i) => (
          <li
            key={r.style.id}
            className="border border-line rounded-lg p-6 bg-white"
          >
            <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
              <h3 className="text-xl font-semibold">
                <span className="font-mono text-xs text-secondary mr-2">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {r.style.namePt}
              </h3>
              <span className="font-mono text-xs text-muted">
                compatibilidade {(r.score * 100).toFixed(0)}
              </span>
            </div>
            <p className="text-sm text-muted mb-4">{r.style.description}</p>

            <ul className="space-y-1 mb-4">
              {r.explanation.map((e, j) => (
                <li key={j} className="text-sm flex gap-2">
                  <span className="text-primary shrink-0">—</span>
                  <span>{e}</span>
                </li>
              ))}
              {r.penalties.map((p, j) => (
                <li key={`p${j}`} className="text-sm flex gap-2 text-warning">
                  <span className="shrink-0">!</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            {r.bridge && (
              <p className="font-mono text-xs text-secondary mb-4">
                requer procedimento: {r.bridge}
              </p>
            )}

            {photoDataUrl ? (
              <button
                onClick={() => setTryOnStyle(r)}
                className="font-mono text-xs uppercase tracking-widest text-primary hover:text-ink"
              >
                Ver no meu rosto →
              </button>
            ) : (
              <p className="font-mono text-xs text-muted">
                simulação disponível ao analisar com a sua foto
              </p>
            )}
          </li>
        ))}
      </ol>

      {results.length === 0 && (
        <p className="text-center text-muted">
          Nenhum estilo compatível com as restrições atuais — tente ampliar a
          abertura a procedimentos químicos.
        </p>
      )}

      {tryOnStyle && (
        <TryOn
          scored={tryOnStyle}
          photoDataUrl={photoDataUrl}
          onClose={() => setTryOnStyle(null)}
        />
      )}
    </div>
  );
}
