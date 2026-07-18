"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  ArchetypeVector,
  HairProfile,
  ShapeResult,
} from "@/lib/types";
import { recommend } from "@/lib/engine";
import { classify } from "@/lib/faceShape";
import PhotoStep from "@/components/PhotoStep";
import HairQuiz from "@/components/HairQuiz";
import PersonalityQuiz from "@/components/PersonalityQuiz";
import Results from "@/components/Results";

type Step = "foto" | "cabelo" | "personalidade" | "resultado";

const STEPS: { id: Step; label: string }[] = [
  { id: "foto", label: "Foto" },
  { id: "cabelo", label: "Cabelo" },
  { id: "personalidade", label: "Projeção" },
  { id: "resultado", label: "Resultado" },
];

export default function AnalisePage() {
  const [step, setStep] = useState<Step>("foto");
  const [face, setFace] = useState<ShapeResult | null>(null);
  const [photo, setPhoto] = useState<string>("");
  const [profile, setProfile] = useState<HairProfile | null>(null);
  const [desired, setDesired] = useState<ArchetypeVector | null>(null);

  const results = useMemo(() => {
    if (!face || !profile || !desired) return [];
    return recommend(face, profile, desired);
  }, [face, profile, desired]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <main className="flex-1">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <nav className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 sm:px-6">
          <Link href="/" className="text-lg sm:text-xl font-bold italic shrink-0">
            Visagia
          </Link>
          <ol
            className="flex gap-3 sm:gap-4 overflow-x-auto whitespace-nowrap"
            aria-label="Progresso"
          >
            {STEPS.map((s, i) => (
              <li
                key={s.id}
                aria-current={s.id === step ? "step" : undefined}
                className={`font-mono text-[11px] sm:text-xs uppercase tracking-widest ${
                  i < stepIndex
                    ? "text-success"
                    : i === stepIndex
                      ? "text-primary"
                      : "text-line"
                }`}
              >
                {s.label}
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        {step === "foto" && (
          <PhotoStep
            onAnalyzed={(result, dataUrl) => {
              setFace(result);
              setPhoto(dataUrl);
              setStep("cabelo");
            }}
            onDemo={() => {
              // Sample analysis: an oval face leaning square, so the demo
              // shows blended membership and the full results experience.
              setFace(
                classify({
                  faceLength: 1.38,
                  cheekWidth: 1,
                  foreheadWidth: 0.92,
                  jawWidth: 0.93,
                  jawAngularity: 0.65,
                  chinPointedness: 0.3,
                  poseDeviation: 0,
                })
              );
              setPhoto("");
              setStep("cabelo");
            }}
          />
        )}

        {step === "cabelo" && (
          <HairQuiz
            onDone={(p) => {
              setProfile(p);
              setStep("personalidade");
            }}
          />
        )}

        {step === "personalidade" && (
          <PersonalityQuiz
            onDone={(d) => {
              setDesired(d);
              setStep("resultado");
            }}
          />
        )}

        {step === "resultado" && face && (
          <Results face={face} results={results} photoDataUrl={photo} />
        )}
      </div>
    </main>
  );
}
