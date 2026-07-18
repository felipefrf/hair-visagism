"use client";

// Personality projection quiz — the visagism layer. The user picks up to 3
// archetypes and weights follow selection order (visagism-domain.md §1.3:
// desired perception, not psychological diagnosis).

import { useState } from "react";
import type { Archetype, ArchetypeVector } from "@/lib/types";
import { ARCHETYPES } from "@/lib/types";

interface Props {
  onDone: (desired: ArchetypeVector) => void;
}

const DESCRIPTIONS: Record<Archetype, { title: string; desc: string }> = {
  ousado: {
    title: "Ousadia",
    desc: "Presença forte, decisão, impacto — linhas retas e ângulos marcados.",
  },
  criativo: {
    title: "Criatividade",
    desc: "Originalidade e movimento — diagonais, assimetria, textura visível.",
  },
  acolhedor: {
    title: "Acolhimento",
    desc: "Proximidade e simpatia — curvas suaves e acabamento natural.",
  },
  profissional: {
    title: "Profissionalismo",
    desc: "Confiabilidade e controle — simetria, polimento, linhas limpas.",
  },
  elegante: {
    title: "Elegância",
    desc: "Sofisticação atemporal — comprimento, brilho, gesto contido.",
  },
  romantico: {
    title: "Romantismo",
    desc: "Delicadeza e fluidez — ondas longas, camadas suaves, franjas leves.",
  },
  sereno: {
    title: "Serenidade",
    desc: "Calma e constância — formas arredondadas, baixo contraste.",
  },
};

const ORDER_WEIGHTS = [1, 0.6, 0.35];

export default function PersonalityQuiz({ onDone }: Props) {
  const [picked, setPicked] = useState<Archetype[]>([]);

  const toggle = (a: Archetype) => {
    setPicked((prev) =>
      prev.includes(a)
        ? prev.filter((x) => x !== a)
        : prev.length < 3
          ? [...prev, a]
          : prev
    );
  };

  const submit = () => {
    const vec = Object.fromEntries(
      ARCHETYPES.map((a) => [a, 0])
    ) as ArchetypeVector;
    picked.forEach((a, i) => {
      vec[a] = ORDER_WEIGHTS[i];
    });
    onDone(vec);
  };

  return (
    <div>
      <h2 className="text-3xl font-semibold mb-3 text-center">
        O que você quer projetar?
      </h2>
      <p className="text-muted text-center max-w-md mx-auto mb-10">
        Escolha até 3, em ordem de importância. Cada intenção tem uma
        linguagem visual de linhas e volumes — e muda o ranking.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-10">
        {ARCHETYPES.map((a) => {
          const idx = picked.indexOf(a);
          const selected = idx >= 0;
          return (
            <button
              key={a}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(a)}
              className={`text-left p-4 rounded-lg border transition-colors ${
                selected
                  ? "border-secondary bg-secondary/5"
                  : "border-line hover:border-muted"
              }`}
            >
              <span className="flex items-center gap-2 mb-1">
                {selected && (
                  <span className="font-mono text-xs text-secondary">
                    {idx + 1}º
                  </span>
                )}
                <span className="font-semibold">{DESCRIPTIONS[a].title}</span>
              </span>
              <span className="text-sm text-muted">{DESCRIPTIONS[a].desc}</span>
            </button>
          );
        })}
      </div>

      <div className="text-center">
        <button
          disabled={picked.length === 0}
          onClick={submit}
          className="bg-ink text-white font-mono text-sm px-8 py-3 rounded-lg hover:bg-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Ver recomendações
        </button>
      </div>
    </div>
  );
}
