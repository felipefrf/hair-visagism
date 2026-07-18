// Face-shape classification from MediaPipe Face Landmarker output.
// Landmark indices per the canonical FaceMesh map (docs/research/tech-feasibility.md §1.1):
//   10 = top of forehead (hairline, midline)   152 = chin bottom (menton)
//   234 / 454 = leftmost / rightmost face oval (cheek level)
//   172 / 397 = jaw corners (gonion)
//   103 / 332 = forehead sides (temporal crest)
//   58 / 288  = lower jaw sides (for angularity)

import type {
  FaceMeasurements,
  FaceRatios,
  FaceShape,
  ShapeResult,
} from "./types";
import { FACE_SHAPES } from "./types";

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

const dist = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export function measure(
  lm: Landmark[],
  poseDeviation = 0
): FaceMeasurements {
  const faceLength = dist(lm[10], lm[152]);
  const cheekWidth = dist(lm[234], lm[454]);
  const foreheadWidth = dist(lm[103], lm[332]);
  const jawWidth = dist(lm[172], lm[397]);

  // Jaw angularity: how far the mid-jaw points (58/288) sit outside the
  // straight chin→gonion line. Wider mid-jaw relative to the taper → squarer.
  const lowerJaw = dist(lm[58], lm[288]);
  const jawAngularity = clamp01((lowerJaw / jawWidth - 0.72) / 0.25);

  // Chin pointedness: narrow chin base relative to jaw width → pointed.
  const chinBase = dist(lm[148], lm[377]);
  const chinPointedness = clamp01(1 - (chinBase / jawWidth - 0.18) / 0.3);

  return {
    faceLength,
    cheekWidth,
    foreheadWidth,
    jawWidth,
    jawAngularity,
    chinPointedness,
    poseDeviation,
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function ratios(m: FaceMeasurements): FaceRatios {
  return {
    r: m.faceLength / m.cheekWidth,
    f: m.foreheadWidth / m.cheekWidth,
    j: m.jawWidth / m.cheekWidth,
  };
}

// Shape prototypes in (r, f, j, angularity, chinPointedness) space.
// Calibrated to the trade conventions (visagism-domain.md §2.2):
// oval r≈1.45; round/square r≈1.05; oblong r≥1.65; heart wide forehead +
// pointed chin; diamond narrow forehead and jaw; triangle jaw-dominant.
const PROTOTYPES: Record<FaceShape, [number, number, number, number, number]> = {
  oval:     [1.45, 0.90, 0.82, 0.35, 0.45],
  round:    [1.05, 0.88, 0.85, 0.15, 0.20],
  square:   [1.05, 0.92, 0.98, 0.85, 0.15],
  heart:    [1.40, 1.02, 0.72, 0.35, 0.85],
  diamond:  [1.45, 0.78, 0.74, 0.45, 0.80],
  oblong:   [1.70, 0.90, 0.88, 0.45, 0.35],
  triangle: [1.30, 0.78, 1.02, 0.55, 0.25],
};

// Feature weights: length ratio dominates, then width distribution.
const WEIGHTS = [2.2, 1.6, 1.6, 0.9, 0.8];
const SOFTMAX_TEMP = 9;

export function classify(m: FaceMeasurements): ShapeResult {
  const rr = ratios(m);
  const feat = [rr.r, rr.f, rr.j, m.jawAngularity, m.chinPointedness];

  const scores = FACE_SHAPES.map((shape) => {
    const p = PROTOTYPES[shape];
    let d = 0;
    for (let i = 0; i < feat.length; i++) {
      d += WEIGHTS[i] * (feat[i] - p[i]) ** 2;
    }
    return { shape, score: -Math.sqrt(d) };
  });

  const max = Math.max(...scores.map((s) => s.score));
  const exps = scores.map((s) => Math.exp(SOFTMAX_TEMP * (s.score - max)));
  const sum = exps.reduce((a, b) => a + b, 0);

  const membership = {} as Record<FaceShape, number>;
  scores.forEach((s, i) => {
    membership[s.shape] = exps[i] / sum;
  });

  const ranked = [...FACE_SHAPES].sort((a, b) => membership[b] - membership[a]);

  return {
    membership,
    primary: ranked[0],
    secondary: ranked[1],
    confidence: membership[ranked[0]],
    ratios: rr,
    measurements: m,
  };
}

export const SHAPE_LABELS_PT: Record<FaceShape, string> = {
  oval: "Oval",
  round: "Redondo",
  square: "Quadrado",
  heart: "Coração",
  diamond: "Diamante",
  oblong: "Alongado",
  triangle: "Triangular",
};

export const SHAPE_GOALS_PT: Record<FaceShape, string> = {
  oval:
    "Rosto equilibrado — quase tudo funciona; o objetivo é preservar a proporção natural.",
  round:
    "Alongar visualmente: linhas verticais, volume no topo e laterais próximas ao rosto.",
  square:
    "Suavizar (ou celebrar) os ângulos do maxilar com curvas e movimento — ou linhas limpas na convenção masculina.",
  heart:
    "Reduzir a leitura da testa larga e adicionar peso visual na altura do maxilar.",
  diamond:
    "Ampliar testa e maxilar, suavizando a proeminência das maçãs do rosto.",
  oblong:
    "Encurtar e alargar: volume lateral, franja, nunca altura extra no topo.",
  triangle:
    "Equilibrar o maxilar mais largo adicionando volume do topo até as maçãs do rosto.",
};

// Quality gating thresholds for the capture step.
export const MAX_POSE_DEVIATION_DEG = 12;
