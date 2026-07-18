"use client";

// Generative try-on. The photo only leaves the device HERE, after explicit
// consent, and the server deletes it after rendering (LGPD Art. 11 —
// purpose-specific consent, minimal retention).

import { useState } from "react";
import type { ScoredStyle } from "@/lib/types";

interface Props {
  scored: ScoredStyle;
  photoDataUrl: string;
  onClose: () => void;
}

type State =
  | { kind: "consent" }
  | { kind: "rendering" }
  | { kind: "done"; imageUrl: string }
  | { kind: "error"; message: string };

export default function TryOn({ scored, photoDataUrl, onClose }: Props) {
  const [state, setState] = useState<State>({ kind: "consent" });

  const render = async () => {
    setState({ kind: "rendering" });
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          image: photoDataUrl,
          styleId: scored.style.id,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({
          kind: "error",
          message: body.error ?? "Falha ao gerar a simulação.",
        });
        return;
      }
      setState({ kind: "done", imageUrl: body.imageUrl });
    } catch {
      setState({ kind: "error", message: "Falha de conexão ao gerar a simulação." });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Simulação: ${scored.style.namePt}`}
      className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-semibold">{scored.style.namePt}</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="font-mono text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>

        {state.kind === "consent" && (
          <div>
            <p className="text-sm text-muted mb-4">
              Para simular este corte na sua foto, precisamos enviá-la uma
              única vez ao nosso serviço de renderização.
            </p>
            <ul className="text-sm space-y-1 mb-6">
              <li className="flex gap-2">
                <span className="text-success">✓</span> Uso exclusivo para gerar
                esta simulação
              </li>
              <li className="flex gap-2">
                <span className="text-success">✓</span> Apagada do servidor após
                a renderização
              </li>
              <li className="flex gap-2">
                <span className="text-success">✓</span> Nunca usada para treinar
                modelos
              </li>
            </ul>
            <button
              onClick={render}
              className="w-full bg-ink text-white font-mono text-sm px-6 py-3 rounded-lg hover:bg-primary transition-colors"
            >
              Concordo — gerar simulação
            </button>
          </div>
        )}

        {state.kind === "rendering" && (
          <div className="text-center py-12">
            <p className="font-mono text-sm text-primary animate-pulse">
              Gerando sua simulação… (~10–20s)
            </p>
          </div>
        )}

        {state.kind === "done" && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.imageUrl}
              alt={`Você com ${scored.style.namePt}`}
              className="w-full rounded-lg mb-4"
            />
            <p className="font-mono text-xs text-muted text-center">
              Simulação aproximada — leve como referência ao seu profissional,
              não como promessa.
            </p>
          </div>
        )}

        {state.kind === "error" && (
          <div className="text-center py-8">
            <p className="text-sm text-danger mb-4">{state.message}</p>
            <button
              onClick={render}
              className="font-mono text-xs uppercase tracking-widest text-primary"
            >
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
