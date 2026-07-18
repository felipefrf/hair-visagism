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

const mid = (a: Landmark, b: Landmark): Landmark => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
});

// Landmark pairs used per measurement. Averaging several parallel pairs makes
// each width robust to single-point jitter and mild occlusion (hair over one
// temple, earring shadows, etc.) — the single biggest F1 lever short of
// training on labeled data.
export const MEASUREMENT_LANDMARKS = {
  faceLength: [[10, 152]],
  cheekWidth: [
    [234, 454], // face oval extremes at cheek level
    [116, 345], // zygomatic arch
    [93, 323], // just below the arch
  ],
  foreheadWidth: [
    [103, 332], // temporal crest
    [67, 297], // upper forehead
    [54, 284], // hairline corners
  ],
  jawWidth: [
    [172, 397], // gonion
    [136, 365], // slightly above gonion
  ],
  midJaw: [
    [58, 288],
    [214, 434],
  ],
  chinBase: [
    [148, 377],
    [176, 400],
  ],
} as const;

const avgDist = (lm: Landmark[], pairs: readonly (readonly number[])[]) =>
  pairs.reduce((sum, [a, b]) => sum + dist(lm[a], lm[b]), 0) / pairs.length;

/**
 * Estimate yaw from depth asymmetry of the cheek extremes: when the head
 * turns, the far cheek's z grows relative to the near one. Widths measured
 * on a turned face shrink by ~cos(yaw); we correct them back.
 */
function estimateYawRad(lm: Landmark[]): number {
  const dz = Math.abs(lm[234].z - lm[454].z);
  const w = dist(lm[234], lm[454]);
  return Math.atan2(dz, w);
}

export function measure(
  lm: Landmark[],
  poseDeviation = 0
): FaceMeasurements {
  const L = MEASUREMENT_LANDMARKS;
  const yaw = estimateYawRad(lm);
  const widthCorrection = 1 / Math.max(Math.cos(yaw), 0.85);

  const faceLength = avgDist(lm, L.faceLength);
  const cheekWidth = avgDist(lm, L.cheekWidth) * widthCorrection;
  const foreheadWidth = avgDist(lm, L.foreheadWidth) * widthCorrection;
  const jawWidth = avgDist(lm, L.jawWidth) * widthCorrection;

  // Jaw angularity via the gonial bend: angle at the jaw corner between the
  // chin direction and the ear direction, averaged over both sides. A square
  // jaw approaches 90° (sharp bend); a round jaw flattens toward 180°.
  const angleAt = (corner: Landmark, up: Landmark, chin: Landmark) => {
    const v1 = { x: up.x - corner.x, y: up.y - corner.y };
    const v2 = { x: chin.x - corner.x, y: chin.y - corner.y };
    const cos =
      (v1.x * v2.x + v1.y * v2.y) /
      (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  };
  const gonialL = angleAt(lm[172], lm[234], lm[152]);
  const gonialR = angleAt(lm[397], lm[454], lm[152]);
  const gonialDeg = ((gonialL + gonialR) / 2) * (180 / Math.PI);
  // ~170° (flat/round) → 0 ; ~125° (sharp/square) → 1
  const jawAngularity = clamp01((170 - gonialDeg) / 45);

  // Chin pointedness: narrow chin base relative to jaw width → pointed.
  const chinBase = avgDist(lm, L.chinBase) * widthCorrection;
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
