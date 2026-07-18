"use client";

import { useState } from "react";
import type { FaceShape, ScoredStyle, ShapeResult } from "@/lib/types";
import { SHAPE_GOALS_PT, SHAPE_LABELS_PT } from "@/lib/faceShape";
import TryOn from "./TryOn";

const LEGEND = {
  faceLength: "#3b82f6",
  foreheadWidth: "#16a34a",
  cheekWidth: "#8b5cf6",
  jawWidth: "#d97706",
} as const;

function MeasurementPanel({
  face,
  annotatedDataUrl,
}: {
  face: ShapeResult;
  annotatedDataUrl?: string;
}) {
  const { ratios: r, membership } = face;
  const top3 = (Object.entries(membership) as [FaceShape, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const rows: { label: string; value: string; note: string; color?: string }[] = [
    {
      label: "Comprimento ÷ largura",
      value: r.r.toFixed(2),
      color: LEGEND.faceLength,
      note:
        r.r < 1.15
          ? "rosto curto (família redondo/quadrado)"
          : r.r > 1.6
            ? "rosto longo (alongado)"
            : "comprimento equilibrado",
    },
    {
      label: "Testa ÷ maçãs do rosto",
      value: r.f.toFixed(2),
      color: LEGEND.foreheadWidth,
      note:
        r.f > 0.97
          ? "testa dominante"
          : r.f < 0.82
            ? "testa mais estreita"
            : "testa proporcional",
    },
    {
      label: "Maxilar ÷ maçãs do rosto",
      value: r.j.toFixed(2),
      color: LEGEND.jawWidth,
      note:
        r.j > 0.95
          ? "maxilar dominante"
          : r.j < 0.78
            ? "maxilar afilado"
            : "maxilar proporcional",
    },
    {
      label: "Maçãs do rosto (referência)",
      value: "1.00",
      color: LEGEND.cheekWidth,
      note: "todas as larguras são medidas em relação a ela",
    },
    {
      label: "Angularidade do maxilar",
      value: `${(face.measurements.jawAngularity * 100).toFixed(0)}%`,
      note:
        face.measurements.jawAngularity > 0.6
          ? "ângulos marcados"
          : "contorno suave",
    },
  ];

  return (
    <details className="max-w-lg mx-auto mt-6 text-left border border-line rounded-lg">
      <summary className="cursor-pointer px-4 py-3 font-mono text-xs uppercase tracking-widest text-primary">
        Como chegamos nesse resultado
      </summary>
      <div className="px-4 pb-4">
        {annotatedDataUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={annotatedDataUrl}
              alt="Sua foto com as linhas de medição da análise"
              className="w-full rounded-lg mb-2"
            />
            <p className="text-xs text-muted mb-4">
              As linhas coloridas são exatamente o que o algoritmo mediu no seu
              rosto — as cores casam com a tabela abaixo.
            </p>
          </>
        )}
        <table className="w-full text-sm mb-4">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <td className="py-2 pr-2">
                  {row.color && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle"
                      style={{ backgroundColor: row.color }}
                    />
                  )}
                  {row.label}
                </td>
                <td className="py-2 pr-2 font-mono text-xs">{row.value}</td>
                <td className="py-2 text-muted text-xs">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="font-mono text-xs uppercase tracking-widest text-muted mb-2">
          Proximidade por formato
        </p>
        {top3.map(([shape, m]) => (
          <div key={shape} className="flex items-center gap-2 mb-1">
            <span className="text-sm w-24 shrink-0">
              {SHAPE_LABELS_PT[shape]}
            </span>
            <span
              className="h-2 rounded bg-primary/70"
              style={{ width: `${Math.round(m * 100)}%`, maxWidth: "70%" }}
            />
            <span className="font-mono text-xs text-muted">
              {(m * 100).toFixed(0)}%
            </span>
          </div>
        ))}
        <p className="text-xs text-muted mt-3">
          Medidas tiradas de 478 pontos faciais, corrigidas pela rotação da
          cabeça. Barba volumosa, sorriso largo ou cabelo sobre a testa podem
          alterar a leitura — na dúvida, refaça com o rosto neutro e cabelo
          afastado.
        </p>
      </div>
    </details>
  );
}

interface Props {
  face: ShapeResult;
  results: ScoredStyle[];
  photoDataUrl: string;
  annotatedDataUrl?: string;
}

export default function Results({
  face,
  results,
  photoDataUrl,
  annotatedDataUrl,
}: Props) {
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
        <MeasurementPanel face={face} annotatedDataUrl={annotatedDataUrl} />
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
