// Recommendation engine — implements the scoring model from
// docs/research/visagism-domain.md §5.4:
//   Score = w_h·Harmony + w_p·Personality + w_f·Feasibility − Penalties
// Deterministic and auditable; every fired rule yields a human-readable
// explanation in PT-BR.

import type {
  Archetype,
  ArchetypeVector,
  ChemicalBridge,
  CurlPattern,
  FaceShape,
  HairProfile,
  HairStyle,
  ScoredStyle,
  ShapeResult,
  Silhouette,
} from "./types";
import { ARCHETYPES, FACE_SHAPES } from "./types";
import { SHAPE_LABELS_PT } from "./faceShape";
import { ARCHETYPE_LABELS_PT, CATALOG } from "./catalog";

const W_HARMONY = 0.35;
const W_PERSONALITY = 0.3;
const W_FEASIBILITY = 0.25;
const W_CONTEXT = 0.1;

// Correction targets per face shape (visagism-domain.md §5.4).
// The masculine convention flips square's "soften" goal — the angular jaw
// is celebrated, not corrected.
const TARGETS: Record<FaceShape, Silhouette & { angularity: number }> = {
  oval: { temples: 0, cheeks: 0, jaw: 0, crownHeight: 0, angularity: 0 },
  round: { temples: 0, cheeks: -2, jaw: 0, crownHeight: 2, angularity: 1 },
  square: { temples: 0, cheeks: 0, jaw: -1, crownHeight: 1, angularity: -2 },
  heart: { temples: -1, cheeks: 0, jaw: 2, crownHeight: -1, angularity: -1 },
  diamond: { temples: 2, cheeks: -2, jaw: 1, crownHeight: 0, angularity: -1 },
  oblong: { temples: 1, cheeks: 2, jaw: 1, crownHeight: -2, angularity: 0 },
  triangle: { temples: 2, cheeks: 1, jaw: -2, crownHeight: 2, angularity: 0 },
};

const AXES = ["temples", "cheeks", "jaw", "crownHeight"] as const;
const MAX_AXIS_DIST = 4; // each axis ranges -2..+2

function harmonyForShape(
  style: HairStyle,
  shape: FaceShape,
  convention: HairProfile["convention"]
): number {
  const t = { ...TARGETS[shape] };
  if (shape === "square" && convention === "masculina") t.angularity = 1;

  let dist = 0;
  for (const axis of AXES) {
    // Oval is permissive: only penalize extremes, not deviation from zero.
    const target = t[axis];
    const value = style.silhouette[axis];
    dist +=
      shape === "oval"
        ? Math.max(0, Math.abs(value) - 1) / MAX_AXIS_DIST
        : Math.abs(target - value) / MAX_AXIS_DIST;
  }
  dist +=
    Math.abs(t.angularity - style.line.angularity) / MAX_AXIS_DIST;

  return 1 - dist / (AXES.length + 1);
}

export function harmony(
  style: HairStyle,
  face: ShapeResult,
  profile: HairProfile
): number {
  let h = 0;
  for (const shape of FACE_SHAPES) {
    const m = face.membership[shape];
    if (m > 0.02) h += m * harmonyForShape(style, shape, profile.convention);
  }
  return h;
}

function cosine(a: ArchetypeVector, b: ArchetypeVector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of ARCHETYPES) {
    dot += a[k] * b[k];
    na += a[k] ** 2;
    nb += b[k] ** 2;
  }
  if (na === 0 || nb === 0) return 0.5;
  return dot / Math.sqrt(na * nb);
}

// Chemical-cost discounts (visagism-domain.md §5.4).
const BRIDGE_COST: Record<ChemicalBridge, number> = {
  escova: 0.8,
  progressiva: 0.6,
  permanente: 0.4,
  relaxamento: 0.4,
};

const BRIDGE_LABELS_PT: Record<ChemicalBridge, string> = {
  escova: "escova/finalização",
  progressiva: "progressiva (alisamento semi-permanente)",
  permanente: "permanente (ondulação química)",
  relaxamento: "relaxamento",
};

const DENSITY_ORDER = { baixa: 0, media: 1, alta: 2 } as const;

function feasibility(
  style: HairStyle,
  profile: HairProfile
): { score: number; bridge?: ChemicalBridge; reason?: string } {
  if (DENSITY_ORDER[profile.density] < DENSITY_ORDER[style.densityMin]) {
    return {
      score: 0.15,
      reason: `exige densidade ${style.densityMin} — a sua é ${profile.density}`,
    };
  }

  if (style.textureNative.includes(profile.pattern)) {
    return { score: 1 };
  }

  let best: { score: number; bridge: ChemicalBridge } | null = null;
  for (const [bridge, patterns] of Object.entries(style.textureVia) as [
    ChemicalBridge,
    CurlPattern[],
  ][]) {
    if (!patterns.includes(profile.pattern)) continue;
    // Semi/permanent chemistry on already-compromised hair is a hard block.
    if (
      profile.chemicalHistory &&
      (bridge === "progressiva" || bridge === "permanente" || bridge === "relaxamento")
    ) {
      continue;
    }
    if (profile.chemicalOpenness === "nenhuma" && bridge !== "escova") continue;
    if (profile.chemicalOpenness === "leve" && BRIDGE_COST[bridge] < 0.6) continue;
    const score = BRIDGE_COST[bridge];
    if (!best || score > best.score) best = { score, bridge };
  }

  if (best) return { score: best.score, bridge: best.bridge };
  return { score: 0, reason: "fora do alcance do seu padrão de cabelo" };
}

interface Penalty {
  amount: number;
  reason: string;
}

function hardRules(
  style: HairStyle,
  face: ShapeResult,
  profile: HairProfile
): Penalty[] {
  const p: Penalty[] = [];
  const m = face.membership;

  // Chin-length weight on a round face echoes the widest point.
  if (m.round > 0.45 && style.lengthBand === "queixo" && style.silhouette.jaw >= 1) {
    p.push({
      amount: 0.35,
      reason:
        "peso na altura do queixo repete o ponto mais largo de um rosto redondo",
    });
  }
  // Height + tight sides elongates an already long face.
  if (m.oblong > 0.45 && style.silhouette.crownHeight >= 1 && style.silhouette.cheeks <= -1) {
    p.push({
      amount: 0.35,
      reason: "altura no topo com laterais coladas alonga ainda mais o rosto",
    });
  }
  // Full fringe shortens a face that is already short.
  if (m.round > 0.45 && style.foreheadCoverage === "total") {
    p.push({
      amount: 0.25,
      reason: "franja cheia encurta um rosto que já é curto",
    });
  }
  // Exposing the full forehead on a heart face emphasizes its width.
  if (m.heart > 0.45 && style.foreheadCoverage === "nenhuma" && style.silhouette.crownHeight >= 1) {
    p.push({
      amount: 0.2,
      reason: "volume no topo com testa exposta acentua a testa mais larga",
    });
  }
  // Maintenance mismatch.
  if (style.maintenanceMinutes > profile.maintenanceMinutes) {
    p.push({
      amount: 0.15,
      reason: `pede ~${style.maintenanceMinutes} min/dia de styling — acima da sua rotina`,
    });
  }
  return p;
}

function explain(
  style: HairStyle,
  face: ShapeResult,
  profile: HairProfile,
  desired: ArchetypeVector,
  bridge?: ChemicalBridge
): string[] {
  const out: string[] = [];
  const primary = face.primary;
  const t = TARGETS[primary];

  // Geometry rationale — describe the strongest silhouette correction served.
  const contributions = AXES.map((axis) => ({
    axis,
    value: style.silhouette[axis],
    target: t[axis],
    served: t[axis] !== 0 && Math.sign(style.silhouette[axis]) === Math.sign(t[axis]),
  })).filter((c) => c.served);

  const axisPt: Record<(typeof AXES)[number], string> = {
    temples: "na região das têmporas/testa",
    cheeks: "na altura das maçãs do rosto",
    jaw: "na linha do maxilar",
    crownHeight: "no topo",
  };

  if (contributions.length > 0) {
    const c = contributions.sort(
      (a, b) => Math.abs(b.value) - Math.abs(a.value)
    )[0];
    const verb = c.target > 0 ? "adiciona volume" : "reduz volume";
    out.push(
      `${verb} ${axisPt[c.axis]}, equilibrando as proporções do rosto ${SHAPE_LABELS_PT[primary].toLowerCase()}`
    );
  } else if (primary === "oval") {
    out.push(
      "seu rosto oval é o formato mais versátil — este corte preserva o equilíbrio natural"
    );
  }

  // Line-language → archetype rationale.
  const topDesired = ARCHETYPES.filter((a) => desired[a] > 0).sort(
    (a, b) => desired[b] - desired[a]
  )[0] as Archetype | undefined;
  if (topDesired && style.archetypes[topDesired] >= 0.5) {
    const lineDesc =
      style.line.curvature >= 1
        ? "as linhas curvas e o movimento"
        : style.line.diagonality >= 1
          ? "as diagonais e a assimetria"
          : style.line.angularity >= 1
            ? "as linhas retas e os ângulos definidos"
            : "o acabamento controlado";
    out.push(
      `${lineDesc} comunicam ${ARCHETYPE_LABELS_PT[topDesired].toLowerCase()} — exatamente o que você quer projetar`
    );
  }

  // Texture rationale.
  if (bridge) {
    out.push(
      `fora do alcance natural do seu padrão ${profile.pattern}, mas alcançável com ${BRIDGE_LABELS_PT[bridge]} — considere o custo de manutenção e a saúde do fio`
    );
  } else if (style.textureNative.includes(profile.pattern)) {
    out.push(`funciona com o seu padrão ${profile.pattern} sem química`);
  }

  // Maintenance.
  out.push(
    `manutenção: ~${style.maintenanceMinutes} min/dia, salão a cada ${style.salonWeeks} semanas`
  );

  return out;
}

export function recommend(
  face: ShapeResult,
  profile: HairProfile,
  desired: ArchetypeVector,
  limit = 8
): ScoredStyle[] {
  const results: ScoredStyle[] = [];
  for (const style of CATALOG) {
    if (
      style.convention !== "neutra" &&
      style.convention !== profile.convention
    ) {
      continue;
    }

    const feas = feasibility(style, profile);
    if (feas.score === 0) continue;

    const h = harmony(style, face, profile);
    const pers = cosine(desired, style.archetypes);
    const pens = hardRules(style, face, profile);
    const penTotal = pens.reduce((a, b) => a + b.amount, 0);

    const context =
      style.maintenanceMinutes <= profile.maintenanceMinutes ? 1 : 0.4;

    const score =
      W_HARMONY * h +
      W_PERSONALITY * pers +
      W_FEASIBILITY * feas.score +
      W_CONTEXT * context -
      penTotal;

    results.push({
      style,
      score,
      harmony: h,
      personality: pers,
      feasibility: feas.score,
      penalties: pens.map((p) => p.reason),
      bridge: feas.bridge,
      explanation: explain(style, face, profile, desired, feas.bridge),
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
