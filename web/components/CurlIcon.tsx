// Visual example of each curl pattern (1A–4C): three strands drawn as SVG,
// with wave amplitude/frequency growing across the scale so users can match
// by sight instead of by label.

import type { CurlPattern } from "@/lib/types";

const H = 56; // strand height
const STRANDS = [-10, 0, 10]; // x offsets

function strandPath(pattern: CurlPattern, xOff: number): string {
  const family = pattern[0]; // "1" | "2" | "3" | "4"
  const grade = pattern[1]; // "A" | "B" | "C"
  const g = grade === "A" ? 0 : grade === "B" ? 1 : 2;
  const x = 20 + xOff;

  if (family === "1") {
    // Straight: slight bend on 1B/1C.
    const bend = g * 1.2;
    return `M ${x} 4 q ${bend} ${H / 2} 0 ${H}`;
  }

  if (family === "2") {
    // Waves: an S-curve whose amplitude and count grow with grade.
    const amp = 3 + g * 2;
    const waves = 2 + g;
    const seg = H / waves;
    let d = `M ${x} 4`;
    for (let i = 0; i < waves; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      d += ` q ${amp * dir} ${seg / 2} 0 ${seg}`;
    }
    return d;
  }

  if (family === "3") {
    // Curls: tight repeating loops, tighter with grade.
    const amp = 6 - g;
    const loops = 3 + g;
    const seg = H / loops;
    let d = `M ${x} 4`;
    for (let i = 0; i < loops; i++) {
      d += ` c ${amp * 1.6} ${seg * 0.1}, ${amp * 1.6} ${seg * 0.9}, 0 ${seg}`;
      d += ` c ${-amp * 1.2} ${seg * 0.08}, ${-amp * 1.2} ${-seg * 0.08}, 0 0`;
    }
    return d;
  }

  // Family 4 — coily: dense zigzag (Z-pattern), tightest at 4C.
  const amp = 4 - g * 0.6;
  const zigs = 6 + g * 2;
  const seg = H / zigs;
  let d = `M ${x} 4`;
  for (let i = 0; i < zigs; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    d += ` l ${amp * dir} ${seg}`;
  }
  return d;
}

export default function CurlIcon({ pattern }: { pattern: CurlPattern }) {
  return (
    <svg
      width="40"
      height="64"
      viewBox="0 0 40 64"
      aria-hidden="true"
      className="mx-auto"
    >
      {STRANDS.map((off) => (
        <path
          key={off}
          d={strandPath(pattern, off)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
