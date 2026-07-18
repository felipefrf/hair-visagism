# Hair Visagism

An AI-powered visagism platform: users upload a photo, we map their facial
landmarks with computer vision, classify their face shape, and recommend
haircuts (and chemical procedures such as perms, relaxers, and keratin
treatments) that both **flatter their features** and **project the
personality they want to express** — bold, creative, approachable,
professional, elegant, and more.

## How it works (product vision)

1. **Upload a photo** — the app detects facial landmarks in the browser.
2. **Face analysis** — landmark ratios classify face shape (oval, round,
   square, heart, diamond, oblong, triangle) and other features (forehead
   height, jaw angle, facial thirds).
3. **Recommendation** — a visagism rule base crosses face shape × hair type ×
   desired personality projection to rank hairstyles, each with an
   explanation of *why* it works.
4. **Refine by feeling** — the user picks how they want to be perceived
   ("I want to look bold", "I want to look creative") and the ranking adapts.
5. **Live try-on demos** — generative AI renders the user's own face with the
   recommended styles.

## Repository layout

- `docs/research/` — domain, market, user, and technical research that grounds
  the product decisions.
- `docs/plan/` — product plan and technical architecture.

## Status

Pre-MVP: research and planning phase. See `docs/plan/product-plan.md` for the
roadmap.
