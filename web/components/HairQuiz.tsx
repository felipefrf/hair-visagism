"use client";

import { useState } from "react";
import type {
  ChemicalOpenness,
  CurlPattern,
  Density,
  HairProfile,
  Length,
} from "@/lib/types";

interface Props {
  onDone: (profile: HairProfile) => void;
}

const PATTERNS: { value: CurlPattern; label: string }[] = [
  { value: "1A", label: "1A · liso fino" },
  { value: "1B", label: "1B · liso médio" },
  { value: "1C", label: "1C · liso grosso" },
  { value: "2A", label: "2A · ondulado leve" },
  { value: "2B", label: "2B · ondulado" },
  { value: "2C", label: "2C · ondulado forte" },
  { value: "3A", label: "3A · cachos largos" },
  { value: "3B", label: "3B · cachos médios" },
  { value: "3C", label: "3C · cachos fechados" },
  { value: "4A", label: "4A · crespo definido" },
  { value: "4B", label: "4B · crespo em Z" },
  { value: "4C", label: "4C · crespo fechado" },
];

const DENSITIES: { value: Density; label: string }[] = [
  { value: "baixa", label: "Ralo / pouco volume" },
  { value: "media", label: "Médio" },
  { value: "alta", label: "Muito cabelo" },
];

const LENGTHS: { value: Length; label: string }[] = [
  { value: "raspado", label: "Raspado" },
  { value: "curto", label: "Curto" },
  { value: "orelha", label: "Na orelha" },
  { value: "queixo", label: "No queixo" },
  { value: "ombro", label: "No ombro" },
  { value: "longo", label: "Longo" },
];

const OPENNESS: { value: ChemicalOpenness; label: string }[] = [
  { value: "nenhuma", label: "Nada de química" },
  { value: "leve", label: "Só algo leve (progressiva, escova)" },
  { value: "aberta", label: "Aberto(a) a tudo (permanente, relaxamento…)" },
];

const MAINTENANCE: { value: 5 | 15 | 30; label: string }[] = [
  { value: 5, label: "Até 5 min/dia" },
  { value: 15, label: "Até 15 min/dia" },
  { value: 30, label: "30+ min/dia" },
];

export default function HairQuiz({ onDone }: Props) {
  const [pattern, setPattern] = useState<CurlPattern | null>(null);
  const [density, setDensity] = useState<Density | null>(null);
  const [length, setLength] = useState<Length | null>(null);
  const [chemHistory, setChemHistory] = useState<boolean | null>(null);
  const [openness, setOpenness] = useState<ChemicalOpenness | null>(null);
  const [maintenance, setMaintenance] = useState<5 | 15 | 30 | null>(null);
  const [convention, setConvention] = useState<
    "masculina" | "feminina" | null
  >(null);

  const ready =
    pattern && density && length && chemHistory !== null && openness &&
    maintenance && convention;

  return (
    <div>
      <h2 className="text-3xl font-semibold mb-3 text-center">Seu cabelo</h2>
      <p className="text-muted text-center max-w-md mx-auto mb-10">
        O cabelo real limita mais que o formato do rosto — estas respostas
        definem o que é alcançável e a que custo.
      </p>

      <Field label="Padrão de curvatura">
        <ChipGroup options={PATTERNS} value={pattern} onChange={setPattern} />
      </Field>

      <Field label="Densidade">
        <ChipGroup options={DENSITIES} value={density} onChange={setDensity} />
      </Field>

      <Field label="Comprimento atual">
        <ChipGroup options={LENGTHS} value={length} onChange={setLength} />
      </Field>

      <Field label="Seu cabelo passou por descoloração ou química forte recentemente?">
        <ChipGroup
          options={[
            { value: true, label: "Sim" },
            { value: false, label: "Não" },
          ]}
          value={chemHistory}
          onChange={setChemHistory}
        />
      </Field>

      <Field label="Abertura a procedimentos químicos">
        <ChipGroup options={OPENNESS} value={openness} onChange={setOpenness} />
      </Field>

      <Field label="Tempo de styling que você aceita">
        <ChipGroup
          options={MAINTENANCE}
          value={maintenance}
          onChange={setMaintenance}
        />
      </Field>

      <Field label="Convenção de estilo para as sugestões">
        <ChipGroup
          options={[
            { value: "masculina" as const, label: "Masculina" },
            { value: "feminina" as const, label: "Feminina" },
          ]}
          value={convention}
          onChange={setConvention}
        />
      </Field>

      <div className="text-center mt-10">
        <button
          disabled={!ready}
          onClick={() =>
            ready &&
            onDone({
              pattern: pattern!,
              density: density!,
              currentLength: length!,
              chemicalHistory: chemHistory!,
              chemicalOpenness: openness!,
              maintenanceMinutes: maintenance!,
              convention: convention!,
            })
          }
          className="bg-ink text-white font-mono text-sm px-8 py-3 rounded-lg hover:bg-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="mb-8">
      <legend className="font-mono text-xs uppercase tracking-widest text-muted mb-3">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function ChipGroup<T>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
              selected
                ? "border-primary bg-primary/10 text-primary font-medium"
                : "border-line text-ink hover:border-muted"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
