# Product Plan — Hair Visagism (working name: "Visagia")

*Closed scope, MVP feature set, and technology decisions. Synthesized from the four research
reports in `docs/research/` (visagism domain, market/competitors, user insights, tech feasibility).
Last updated: 2026-07-18.*

---

## 1. Positioning (the one-liner)

**A digital visagism consultation: send a photo, get an explainable analysis of your face and hair,
and discover the cuts, colors, and chemical treatments that flatter your features AND project the
personality you want — with realistic previews on your own photo.**

### Why this wedge wins (from the market research)
- Try-on rendering is **commoditized** (Perfect Corp, FaceApp, diffusion wrappers). Trustworthy,
  explainable **recommendation** is scarce — almost every competitor stops at "face shape label →
  generic list".
- **Nobody implements the personality half of visagism** (Hallawell's temperament/archetype layer),
  not even the Brazilian visagism startups (PandaMi, Vizzualiza) — they do geometry only. This is
  our core differentiator and it's completely open.
- The most-cited failures of incumbents map exactly to our strengths: wig-like renders, ignoring
  hair texture (curly/coily especially), no "why", no bridge to the stylist, billing dark patterns,
  privacy fears.

### Product principles (non-negotiable, from user research)
1. **Explain everything** — every recommendation ships with the "why" (proportions + line language + texture), never just a label.
2. **Texture is a first-class input** — recommendations conditioned on curl pattern (1A–4C), density and strand texture; honest "this won't work with your hair, here's why / here's the treatment that unlocks it".
3. **Privacy by architecture** — face analysis runs in the browser; photos only leave the device for opt-in try-on renders, with short TTL deletion. This is both LGPD compliance and marketing.
4. **Honest pricing** — no auto-renew traps, no per-swatch credit burn. Free analysis; pay for the full report/renders.
5. **Bridge to the chair** — output ends in a stylist-ready spec ("leve ao seu cabeleireiro"), not just a picture.

---

## 2. MVP scope (what we build first)

**Platform decision: web-first responsive PWA.** Zero-install, WhatsApp/Instagram-shareable link
(critical in Brazil), the entire CV stack is web-native, one codebase. Mobile app only in Phase 4
(Capacitor wrap or React Native) once retention justifies store presence.

### In scope — MVP (target ~6–10 weeks)

| # | Feature | Detail |
|---|---------|--------|
| 1 | Photo capture/upload with quality gating | `getUserMedia` + upload; reject/warn on pose, lighting, hair-over-face occlusion |
| 2 | On-device facial analysis | MediaPipe Face Landmarker (478 pts, WASM, in-browser); ratio computation (L/C, F/C, J/C, jaw angularity) |
| 3 | Face-shape classification | Rule-based, transparent, **soft membership** (top-2 shapes + confidence, e.g. "oval puxado pra quadrado") |
| 4 | Hair profile quiz | Curl pattern 1A–4C, density, current length, chemical history, maintenance tolerance |
| 5 | Personality projection quiz | 5–8 questions → archetype weight vector (bold/creative/warm/professional/elegant/romantic/serene/edgy), grounded in Hallawell's temperament grammar |
| 6 | Recommendation engine | Scoring model from `docs/research/visagism-domain.md` §5: Harmony (silhouette deltas vs face-shape targets) + Personality (archetype cosine) + Feasibility (texture reachability incl. chemical bridges) + hard-rule penalties |
| 7 | Explainable results page | Ranked styles with example images + generated "why it works" text + maintenance scorecard + chemical-treatment path when applicable |
| 8 | Hairstyle catalog | 60–100 styles as feature vectors (silhouette, line language, fringe, texture compatibility, archetype scores), curated across liso/ondulado/cacheado/crespo, masculine + feminine conventions |
| 9 | Shareable result + stylist handoff | Export/share card with the analysis and chosen styles ("mostre ao seu cabeleireiro") |
| 10 | **Generative try-on** | Render the top recommended styles on the user's own photo via a hosted instruction-editing model (Gemini 2.5 Flash Image or FLUX Kontext via fal.ai, ~$0.04/image); consent-gated upload, async render flow, auto-delete ≤72h |

### Fast follow (post-MVP)
- Evaluate self-hosted **Stable-Hair v2** for reference-exact transfer, multi-view (back of the
  cut), and better curly/coily fidelity — our texture moat.
- Render-quality A/B across providers with a texture-diverse test set (cacheado/crespo focus).

### Explicitly OUT of MVP scope
- Native mobile apps (Phase 4)
- Salon/barbershop B2B mode, booking integrations, stylist marketplace (Phase 4+; the long-term monetization)
- Live AR try-on (camera real-time)
- Hair color science beyond archetype-level direction (full colorimetry later)
- Automatic hair-type detection from photo (quiz first; CV later)
- User accounts beyond a lightweight email gate for renders

---

## 3. Technology stack (decided)

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | **Next.js (React) PWA + TypeScript + Tailwind** | One codebase, SSR for the marketing/SEO side, PWA installable |
| Face analysis | **MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`, WASM/WebGL) | 478 3D landmarks, free, Apache-2.0, runs 100% in-browser → privacy + $0/analysis |
| Classifier | Rule-based ratios w/ soft membership (client-side TS) | Transparent, explainable, no training data needed; later: tiny gradient-boost on ratio vectors |
| Recommendation engine | Deterministic scoring (client- or server-side TS) + LLM only for prose polish of explanations | Auditable rules = the moat; LLM never decides, only phrases |
| Database | **Postgres (Supabase)** | Style catalog, quiz configs, sessions; Supabase auth + storage in one |
| Try-on rendering (Phase 3) | **Gemini 2.5 Flash Image or FLUX Kontext via fal.ai**, serverless queue | Best realism/$ (~$0.04/img), 5–15s latency; graduate to self-hosted Stable-Hair v2 |
| Hosting | Vercel (app) + Supabase (data) | Zero-ops for a 1-person team |
| Photos storage | Supabase/S3, only on render request, encrypted, signed URLs, TTL ≤72h | LGPD Art. 11: consent-specific, minimal retention |

### Privacy/LGPD architecture (design feature, not checkbox)
- Phase 1–2 processes **no biometric data server-side** — "sua foto não sai do seu celular".
- Render flow: explicit purpose-specific consent at the moment of upload; TTL deletion; no training
  on user photos; paid-tier APIs that don't retain data.

---

## 4. Business model (initial hypothesis)

- **Free:** face-shape analysis + 3 recommendations with short explanations.
- **Paid report (R$19–39, one-time):** full visagism report — all recommendations, personality
  layer, maintenance scorecards, chemical-treatment roadmap, stylist handoff pack + (Phase 3)
  try-on renders of top styles. One-time purchase, not subscription — anti-dark-pattern stance.
- **Later (Phase 4):** salon B2B per-chair SaaS + lead-gen (the proven high-LTV model: Perfect Corp
  ~90% GM B2B; PandaMi's 500+ barbershops validate Brazilian salon adoption).

## 5. Success metrics for MVP
- Analysis completion rate (photo → results) > 60%
- Share/export rate > 15% (the viral loop)
- Free → paid report conversion > 3%
- Qualitative: users citing the "why" explanations as the reason they trust the result

## 6. Key risks
| Risk | Mitigation |
|---|---|
| Face-shape accuracy on real selfies (pose/occlusion/lens) | Quality gating, 3D pose correction, top-2 + confidence UX, "pull hair back" instruction |
| Render quality on cacheado/crespo (the #1 incumbent failure) | Phase-3 A/B across models with a texture-diverse test set before launch; honest fallback to catalog imagery |
| Visagism personality layer reads as pseudoscience | Frame as "style archetypes"/visual language, never psychological diagnosis; keep the geometry layer primary |
| Perfect Corp adds recommendation to its agent | Depth moat: personality × texture × feasibility × stylist handoff — API vendors won't build the ops loop |

---

*Marketing page: `marketing/index.html` — built with the TypeUI "Refined" design skill
(`.claude/skills/refined/`), summarizing this scope for stakeholders.*
