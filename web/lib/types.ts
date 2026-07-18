// Domain types for the visagism engine.
// Grounded in docs/research/visagism-domain.md §5.

export type FaceShape =
  | "oval"
  | "round"
  | "square"
  | "heart"
  | "diamond"
  | "oblong"
  | "triangle";

export const FACE_SHAPES: FaceShape[] = [
  "oval",
  "round",
  "square",
  "heart",
  "diamond",
  "oblong",
  "triangle",
];

export interface FaceMeasurements {
  faceLength: number;
  cheekWidth: number;
  foreheadWidth: number;
  jawWidth: number;
  /** 0 (fully rounded jaw) .. 1 (sharply angular jaw) */
  jawAngularity: number;
  /** 0 (rounded chin) .. 1 (pointed chin) */
  chinPointedness: number;
  /** yaw+pitch magnitude in degrees, for quality gating */
  poseDeviation: number;
}

export interface FaceRatios {
  r: number; // length / cheekWidth
  f: number; // foreheadWidth / cheekWidth
  j: number; // jawWidth / cheekWidth
}

export interface ShapeResult {
  /** softmax-normalized membership per shape, sums to 1 */
  membership: Record<FaceShape, number>;
  primary: FaceShape;
  secondary: FaceShape;
  confidence: number; // membership of primary
  ratios: FaceRatios;
  measurements: FaceMeasurements;
}

// --- Hair profile -----------------------------------------------------------

export type CurlPattern =
  | "1A" | "1B" | "1C"
  | "2A" | "2B" | "2C"
  | "3A" | "3B" | "3C"
  | "4A" | "4B" | "4C";

export type Density = "baixa" | "media" | "alta";
export type Length = "raspado" | "curto" | "orelha" | "queixo" | "ombro" | "longo";
export type ChemicalOpenness = "nenhuma" | "leve" | "aberta";
export type Hairline = "cheia" | "entradas" | "rarefeita";
export type HairlinePref = "disfarcar" | "assumir";

export interface HairProfile {
  pattern: CurlPattern;
  density: Density;
  currentLength: Length;
  chemicalHistory: boolean; // bleached/relaxed/damaged
  chemicalOpenness: ChemicalOpenness;
  /** minutes per day the user accepts styling */
  maintenanceMinutes: 5 | 15 | 30;
  convention: "masculina" | "feminina";
  hairline: Hairline;
  /** only relevant when hairline !== "cheia" */
  hairlinePref?: HairlinePref;
}

// --- Personality projection --------------------------------------------------

export type Archetype =
  | "ousado"       // bold — choleric line language
  | "criativo"     // creative — sanguine
  | "acolhedor"    // warm/approachable — phlegmatic
  | "profissional" // professional — choleric/controlled
  | "elegante"     // elegant — melancholic/refined
  | "romantico"    // romantic — melancholic
  | "sereno";      // serene — phlegmatic

export const ARCHETYPES: Archetype[] = [
  "ousado",
  "criativo",
  "acolhedor",
  "profissional",
  "elegante",
  "romantico",
  "sereno",
];

export type ArchetypeVector = Record<Archetype, number>;

// --- Style catalog -----------------------------------------------------------

export type Fringe =
  | "nenhuma"
  | "reta"
  | "cortina"
  | "lateral"
  | "texturizada";

export type ChemicalBridge = "escova" | "progressiva" | "permanente" | "relaxamento";

export interface Silhouette {
  temples: number;     // -2..+2 visual width added at temples/forehead
  cheeks: number;      // -2..+2 at cheekbones
  jaw: number;         // -2..+2 at jawline
  crownHeight: number; // -2..+2 vertical volume on top
}

export interface LineLanguage {
  straightness: number; // -2..+2
  curvature: number;
  diagonality: number;
  angularity: number;
}

export interface HairStyle {
  id: string;
  name: string;
  namePt: string;
  description: string;
  convention: "masculina" | "feminina" | "neutra";
  lengthBand: Length;
  silhouette: Silhouette;
  line: LineLanguage;
  fringe: Fringe;
  foreheadCoverage: "nenhuma" | "parcial" | "total";
  /** natural curl patterns that support the style as-is */
  textureNative: CurlPattern[];
  /** chemical bridges that unlock it for other patterns */
  textureVia: Partial<Record<ChemicalBridge, CurlPattern[]>>;
  densityMin: Density;
  maintenanceMinutes: number;
  salonWeeks: number;
  archetypes: ArchetypeVector;
  /** prompt fragment for the generative try-on */
  renderPrompt: string;
}

// --- Recommendation ----------------------------------------------------------

export interface ScoredStyle {
  style: HairStyle;
  score: number;
  harmony: number;
  personality: number;
  feasibility: number;
  penalties: string[];
  bridge?: ChemicalBridge;
  explanation: string[];
}
