# Technical Research Report: AI Hair Consultation & Virtual Try-On Web Product

Research date: July 2026. Scope: (a) photo capture, (b) landmark detection + face-shape classification, (c) recommendation engine (face shape × personality projection), (d) generative try-on previews.

---

## 1. Face Landmark Detection

### 1.1 MediaPipe Face Landmarker (recommended)

Google's [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) is the clear default choice for this product:

- **478 3D landmarks** per face (468 mesh points + 10 iris points), plus 52 blendshapes and a facial transformation matrix ([Web JS guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)).
- **Runs entirely in-browser** via the `@mediapipe/tasks-vision` npm package with a WASM runtime loaded from CDN (`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`), GPU-accelerated via WebGL. Works in `IMAGE` mode (`detect()`) for a single photo or `VIDEO` mode for live preview.
- **Free, Apache-2.0 licensed, zero per-call cost, and privacy-preserving by construction** — the photo never leaves the device for the analysis step. This matters a lot for LGPD/GDPR (Section 4).
- Real-world browser latency is tens of milliseconds per frame on a mid-range phone; a single still-photo inference is effectively instant.

**Computing face-shape measurements from the mesh.** The landmark semantics are documented informally via the canonical mesh map (see [google-ai-edge/mediapipe issue #1615](https://github.com/google-ai-edge/mediapipe/issues/1615), the [face_mesh solution docs](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md), and community references like [understanding-mediapipe-facemesh-output](https://github.com/lschmelzeisen/understanding-mediapipe-facemesh-output) and [this annotated landmark visualizer](https://www.sanderdesnaijer.com/blog/mediapipe-face-mesh-landmarks)). Commonly used indices for face-shape ratios (verify against the canonical UV map in your build):

| Measurement | Landmark indices (common convention) |
|---|---|
| Face length | **10** (top of forehead, midline) ↔ **152** (bottom of chin) |
| Face width (cheekbone/zygomatic) | **234** ↔ **454** (leftmost/rightmost points of the face oval) or **116/345** (cheekbone) |
| Jaw width (gonial) | **172 ↔ 397** or **58 ↔ 288** (jaw corners below the ear) |
| Forehead width | **103 ↔ 332** (or 67/297 along the hairline) |
| Chin/jaw angle | vectors from 152 to the two gonial points |

One caveat: MediaPipe's mesh has **sparse forehead coverage** — point 10 sits near the hairline, so "face length" is really hairline-to-chin; if hair covers the forehead the top point is estimated, not observed. A [recent walkthrough of exactly this use case](https://rs111.medium.com/how-i-created-a-simple-face-shape-detector-with-mediapipe-77e35fe61d99) (face-shape detector built on MediaPipe) confirms the ratio-based approach works well in practice. Use the 3D coordinates (or the transformation matrix) to correct for head pose before computing ratios.

### 1.2 face-api.js

[face-api.js](https://learnopencv.com/what-is-face-detection-the-ultimate-guide/) is a TensorFlow.js library with **68-point landmarks**, face detection, and expression recognition. It's free and browser-based, but the original repo has been essentially unmaintained for years (community forks like `@vladmandic/face-api` carry it forward). 68 points give you jawline and eyes/nose/mouth but far less geometry than 478 points — workable for coarse ratios, but there's no reason to prefer it over MediaPipe in 2026. Skip it.

### 1.3 Cloud APIs

- **Azure Face**: effectively **off the table**. Microsoft's [Limited Access policy](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/computer-vision/limited-access-identity) requires registration and restricts identification/verification to Microsoft-managed customers; more importantly, [facial *attribute* analysis (age, gender, hair, etc.) was retired](https://azure.microsoft.com/en-us/blog/responsible-ai-investments-and-safeguards-for-facial-recognition/) — new customers lost access June 21, 2022 and existing ones June 30, 2023. Basic landmark detection remains available without registration, but it's only 27 landmarks and adds cost + a server round-trip.
- **AWS Rekognition** (`DetectFaces`): returns ~30 landmarks + bounding box; ~$1 per 1,000 images. Coarser than MediaPipe, costs money, and requires uploading the face photo to your server/AWS — a privacy and LGPD liability you don't need.
- **Google Cloud Vision** face detection: ~34 landmarks, ~$1.50/1,000 images after free tier; same story.

**Comparison summary**

| Option | Landmarks | Cost | Privacy | Verdict |
|---|---|---|---|---|
| MediaPipe Face Landmarker (browser) | 478 (3D) | $0 | On-device | ✅ Use this |
| face-api.js | 68 | $0 | On-device | Unmaintained; skip |
| AWS Rekognition | ~30 | ~$1/1k | Server-side | Overkill, worse geometry |
| Azure Face | 27 | ~$1/1k | Server-side | Attribute analysis retired; restricted |
| Google Vision | ~34 | ~$1.50/1k | Server-side | Skip |

---

## 2. Face Shape Classification

### 2.1 Rule-based ratios (recommended for MVP)

The standard approach computes **4–5 ratios** from the landmark measurements above and maps them to shapes ([example 6-shape classifier](https://realsmile.online/face-shape-calculator), [8-shape variant](https://facecalculators.com/)):

- `length / cheek_width` — >1.5 → oblong/oval family; ≈1.0 → round/square family
- `forehead_width / cheek_width` — high → heart/inverted triangle
- `jaw_width / cheek_width` — high → square/rectangle; low → heart/diamond
- **Chin angle / jaw angularity** — sharp → square; tapered → oval/heart

Typical taxonomy: oval, round, square, oblong/rectangle, heart, diamond (sometimes + triangle/pear). Rule-based is transparent (you can *show* the user the measurements — great UX for a consultation product), tunable, requires no training data, and runs in milliseconds in the browser.

### 2.2 Small ML classifiers

- **Datasets**: the most-used public one is the [Face Shape Dataset (Niten Lama) on Kaggle](https://www.kaggle.com/nitenlama/face-shape-dataset) (~5,000 images, 5 classes: heart, oblong, oval, round, square — celebrity photos, female-skewed); also a smaller [oval/round/square dataset](https://www.kaggle.com/datasets/attanmhd/face-shape-oval-round-square/data). CNN projects on it ([example](https://github.com/Pratch-yani/Face-Shape-Classification-using-CNN)) typically report 70–90% depending on methodology; a published landmark-feature ML study reported ~70% ([ResearchGate](https://www.researchgate.net/publication/362903132_Human_Face_Shape_Classification_with_Machine_Learning)).
- A pragmatic middle path: train a **small classifier (logistic regression / gradient boosting) on the landmark-derived ratio vector**, not on pixels — tiny, explainable, shippable to the browser as a few KB of weights.

### 2.3 Accuracy caveats (be honest in the UX)

Even humans disagree on face-shape labels; realistic accuracy on clean frontal photos is ~80–90% and degrades with ([discussion](https://thefacereport.com/tools/face-shape)):

- **Pose** — yaw/pitch distorts ratios; use MediaPipe's 3D landmarks or transformation matrix to gate ("please face the camera") and correct.
- **Hair occlusion** — the biggest problem for a *hair* product: bangs/volume hide forehead and jawline. Instruct users to pull hair back; detect occlusion and warn.
- **Lighting/lens** — wide-angle selfie distortion at close range fattens faces; ask for arm's-length or rear-camera photos, even lighting.
- Best practice: return a **confidence score and top-2 shapes** ("mostly oval with square jaw traits") rather than a single hard label — this is also more useful for recommendation logic.

---

## 3. Hairstyle Try-On Rendering (2025–2026 state of the art)

### 3.1 Research models (self-hostable)

- **Barbershop** (2021) and **HairCLIP** (2022): StyleGAN2 latent-space editing; historically important, but GAN inversion loses identity fidelity on real-world photos and struggles with non-frontal poses. Superseded.
- **[HairFastGAN](https://github.com/AIRI-Institute/HairFastGAN)** (NeurIPS 2024, [arXiv:2404.01094](https://arxiv.org/abs/2404.01094)): encoder-based (no per-image optimization), **near-real-time (~seconds on a modern GPU)**, transfers hairstyle + color from a reference photo, robust to pose differences. [Live demo on HF Spaces](https://huggingface.co/spaces/AIRI-Institute/HairFastGAN). Good speed/quality trade-off but inherits GAN limitations at 512px and can drift on identity/skin tone; texture fidelity on tightly curly hair is a known weak spot of StyleGAN-domain methods — important for the Brazilian market where cabelo cacheado/crespo must render well. ([DigitalOcean tutorial](https://www.digitalocean.com/community/tutorials/change-your-hairstyle-in-minutes-hairfastgan) shows self-hosting on a GPU droplet.)
- **[Stable-Hair](https://github.com/Xiaojiu-z/Stable-Hair)** (AAAI 2025, [arXiv:2407.14078](https://arxiv.org/html/2407.14078v2)): diffusion-based two-stage pipeline — a **Bald Converter** removes existing hair, then a Hair Extractor + Latent IdentityNet transfers the reference hairstyle. Noticeably better on **diverse real-world textures (including curls)** and identity preservation than GAN methods, at the cost of diffusion latency (several seconds to ~30s per image on an A100-class GPU).
- **[Stable-Hair v2](https://arxiv.org/abs/2507.07591)** (July 2025): extends this to **multi-view diffusion** — view-consistent transfer across angles (front/side/back previews), pose conditioning via polar-azimuth embeddings. This is the current research SOTA and directly matches the "show me the back of the cut" salon use case.

### 3.2 General-purpose generative editing (fastest to integrate)

- **Gemini 2.5 Flash Image ("Nano Banana")**: instruction-based editing ("give this person a curly bob, keep the face identical") with strong identity preservation; **$0.039/image** official ([Google Developers Blog](https://developers.googleblog.com/en/introducing-gemini-2-5-flash-image/), [API docs](https://ai.google.dev/gemini-api/docs/image-generation)); resellers at ~$0.02–0.03 ([Kie.ai](https://kie.ai/nano-banana), [PiAPI](https://piapi.ai/blogs/free-nano-banana-api-pricing-and-key-access-2025-google-gemini-2-5-flash-via-piapi)). Latency ~5–15s. In 2025–2026 community testing this family became the go-to for identity-preserving photo edits — likely your best realism-per-dollar-per-engineering-hour option.
- **FLUX.1 Kontext** (Black Forest Labs): instruction-based image editing; **[pro] $0.04/image, [max] $0.08** ([bfl.ai/pricing](https://bfl.ai/pricing), [hosted on fal.ai](https://fal.ai/models/fal-ai/flux-pro/kontext)). Strong prompt-following and identity retention; comparable tier to Nano Banana.
- **OpenAI GPT-image**: capable editing but pricing spans **~$0.01–0.20/image** depending on quality/resolution tier ([comparison](https://blog.laozhang.ai/en/posts/ai-image-generation-api-comparison-2026)), generally 3–5× Flux Kontext cost at comparable quality for editing, and historically weaker at *exact* identity preservation (faces drift).
- **SD + ControlNet / IP-Adapter / InstantID** (DIY pipeline): inpaint the hair region (BiSeNet/SAM hair mask) with ControlNet pose/depth conditioning and InstantID/IP-Adapter-FaceID for identity. Maximum control (e.g., fine-tune on Brazilian hair textures, LoRAs per hairstyle category) but the highest engineering cost, and naïve inpainting struggles with hairline blending and volume changes. Choose this only if the hosted editors prove insufficient.

### 3.3 Commercial hair-specific APIs/SDKs

- **[Perfect Corp / YouCam](https://www.perfectcorp.com/business/products/virtual-hairstyles)**: the enterprise leader; [11 dedicated hair & beard APIs](https://www.businesswire.com/news/home/20231026199135/en/), 150+ styles, GAN + AR live try-on, salon-oriented ([salon solution](https://www.businesswire.com/news/home/20221013005644/en/)). Enterprise sales-led pricing (contact sales; historically 5-figure annual SDK licenses) — a Phase 4 B2B consideration, not an MVP one.
- **[LightX Hairstyle API](https://www.lightxeditor.com/api/ai-hairstyle/)**: simple REST, 25 free credits on signup; via [API.market from ~$53/mo](https://api.market/store/lightxeditor/hairstyle) — works out to roughly $0.03–0.10/image depending on tier. Quality is mid-tier.
- **[AILabTools Hairstyle Changer](https://www.ailabtools.com/doc/ai-portrait/effects/hairstyle-editor)** (also [Pro](https://www.ailabtools.com/doc/ai-portrait/effects/hairstyle-editor-pro) and [Premium](https://www.ailabtools.com/docs/ai-portrait/effects/hairstyle-editor-premium) tiers): credit-based; Premium supports hundreds of presets *plus reference-photo hair transfer and color control*; also resold via [RapidAPI](https://rapidapi.com/ailabapi-ailabapi-default/api/hairstyle-changer-pro). Roughly $0.02–0.10/image depending on tier/volume. They even publish a [salon-app integration blueprint](https://www.ailabtools.com/blog/ai-hairstyle-changer-for-hair-salons-an-ai-api-ai-service-blueprint-with-integration-code/).
- **Replicate / fal.ai**: host Flux Kontext, SDXL-inpainting variants and various hair-transfer community models; billed per second or per image (~$0.01–0.05 typical; [fal pricing](https://fal.ai/pricing), [comparison](https://pricepertoken.com/image)). HairFastGAN itself isn't officially on fal, but you can deploy it yourself (Replicate Cog or a Modal/RunPod worker).

### 3.4 Comparison

| Option | Realism | Identity preservation | Curly/afro texture | Latency | Cost/image |
|---|---|---|---|---|---|
| Gemini 2.5 Flash Image | High | High | Good | 5–15s | $0.039 |
| Flux Kontext pro | High | High | Good | 5–15s | $0.04 |
| GPT-image | High | Medium (drift) | Good | 10–30s | $0.01–0.20 |
| Stable-Hair v2 (self-host) | High (SOTA, multi-view) | High | Good | 10–30s | GPU time (~$0.01–0.05) |
| HairFastGAN (self-host) | Medium-high | Medium | Weak on tight curls | ~1–3s | GPU time (<$0.01) |
| AILabTools / LightX | Medium | Medium-high | Variable | 5–15s | $0.02–0.10 |
| Perfect Corp SDK | High + live AR | High | Good | Real-time AR | Enterprise license |
| SD+ControlNet+InstantID DIY | Tunable | Medium-high | Tunable (can fine-tune) | 5–30s | GPU time |

Key product note: with reference-photo-transfer models (Stable-Hair, HairFastGAN, AILabTools Premium), your **hairstyle database photos double as the render conditioning** — one asset powers both recommendation cards and try-on. With prompt-based editors (Nano Banana, Kontext), you instead maintain a well-engineered text prompt per style (cheaper to build, less exact style control) — though both accept reference images in multi-image prompts.

---

## 4. Architecture Recommendation

### Web-first (responsive PWA) — clearly the right MVP call

- **Distribution**: a link is shareable on WhatsApp/Instagram (dominant in Brazil) with zero install friction; app stores add weeks of review and a download barrier for a "try it once, get hooked" product.
- **The core tech is web-native**: MediaPipe Face Landmarker is a first-class browser library ([Web JS guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js)); `getUserMedia` handles camera capture; generative rendering is a server API call regardless of client platform.
- **One codebase**, and a PWA can later be wrapped (Capacitor) if store presence is wanted before a true native app.

### Suggested stack

- **Frontend**: Next.js (React) PWA; camera capture + `@mediapipe/tasks-vision` (WASM/WebGL) for landmarks; face-shape ratio computation and classification **entirely client-side**; quality gating (pose, lighting, occlusion warnings) before accepting the photo.
- **Backend**: Next.js API routes / serverless functions (Vercel or AWS). Hairstyle database in Postgres (Supabase/Neon): style → suitable face shapes, personality tags, maintenance level, hair-texture compatibility, reference images.
- **Try-on rendering**: serverless call to Gemini 2.5 Flash Image or Flux Kontext (via fal.ai) at MVP; queue with job status (renders take 5–20s — design the UX around it). Later, a dedicated GPU worker (Modal/RunPod/Replicate deployment) running Stable-Hair v2 for reference-exact transfer.
- **Storage**: user photos in object storage (S3/Supabase) **only when rendering is requested**, encrypted, short-lived signed URLs, automatic deletion (e.g., 24–72h TTL).

### Privacy — LGPD (Brazil) and GDPR

A face photo processed to extract facial geometry is squarely **sensitive data territory**. Under LGPD, biometric data is expressly **"dado pessoal sensível"** (Art. 5º, II) and may only be processed under Art. 11's restricted bases — in practice, **specific, highlighted, informed consent per purpose**; generic consent is void ([Confidata overview](https://confidata.com.br/blog/lgpd-dados-biometricos-reconhecimento-facial-digital), [analysis](https://barbieriadvogados.com/dados-sensiveis-na-lgpd/), [facial recognition & LGPD](https://www.casilloadvogados.com.br/reconhecimento-facial-e-biometria-limites-e-obrigacoes-sob-a-perspectiva-da-lgpd/)). Sanctions reach **2% of revenue up to R$50M per infraction** (Art. 52). GDPR Art. 9 treats biometric data used for identification similarly.

Practical design (which the architecture above enables cheaply):

1. **Analyze on-device**: landmarks + face-shape classification never leave the browser → for Phase 1 you arguably process no biometric data server-side at all. This is a genuine marketing point ("sua foto não sai do seu celular").
2. When the user requests a generative render, collect **explicit, purpose-specific consent** at that moment; upload only then.
3. **Minimal retention**: auto-delete uploads and renders after a short TTL unless the user saves them to an account; document this in the privacy policy.
4. Don't build face *identification*; you only need geometry — state this. Avoid third-party APIs that retain training rights over uploads (check Gemini API data-use terms; paid tier does not train on your data).
5. Appoint a DPO/encarregado and keep a simple RoPA once you have real traffic; prefer processors with Brazilian/EU data residency options where feasible.

---

## 5. Phased MVP Plan

### Phase 1 — Photo → face shape → rule-based recommendations (2–4 weeks)
- Next.js PWA; MediaPipe in-browser landmarks; ratio-based classifier with confidence + top-2 shapes; photo quality gating.
- Curated hairstyle DB (~50–100 styles, licensed/AI-generated example images) tagged by face-shape suitability and hair texture (crucial: liso/ondulado/cacheado/crespo coverage for Brazil).
- Output: "Your face is oval-leaning-square; these 8 cuts suit you, here's why" with example images (not the user's face).
- **Cost: ~$0 marginal** (hosting only). No sensitive data leaves the device.

### Phase 2 — Personality projection quiz (1–2 weeks)
- 5–8 question quiz mapping to projection axes (e.g., professional/creative, clássica/ousada, low/high maintenance); recommendation = face-shape suitability × personality tags × hair-texture filter.
- Pure product/content work; no new infra. Optionally an LLM-written personalized explanation (~$0.001–0.01/user with a small model).

### Phase 3 — Generative try-on (3–6 weeks)
- Start with **Gemini 2.5 Flash Image or Flux Kontext via fal.ai** (fastest integration, best realism/$); consent + upload flow with TTL deletion; async render queue; render the user's top 3–5 recommended styles.
- Evaluate **AILabTools Premium** (reference transfer) and prototype **Stable-Hair v2** self-hosted for exact-style fidelity; A/B for identity preservation and curly-texture quality with real Brazilian users.
- **Unit economics**: at ~$0.04/image × 4 previews ≈ **$0.16/user session** (Nano Banana/Kontext); ~$0.02–0.10/image via AILabTools/LightX; self-hosted HairFastGAN <$0.01/image but weaker on curls; self-hosted Stable-Hair v2 ~$0.01–0.05/image in GPU time plus ops burden. 1,000 free-tier users/mo ≈ $160/mo in render cost — gate renders behind email signup or a small paywall/credit system early.

### Phase 4 — Mobile app + salon B2B (3+ months)
- Wrap PWA (Capacitor) or React Native app; live AR preview if warranted.
- **B2B salon mode**: tablet consultation tool, salon-branded, per-seat SaaS (this is where [Perfect Corp](https://www.perfectcorp.com/business/products/virtual-hairstyles) plays — either compete at a lower price point or license their SDK if enterprise clients demand real-time AR). Salon booking integration and "leve essa foto ao seu cabeleireiro" export.
- Multi-view previews (Stable-Hair v2's specialty) become a differentiator here: clients want to see the back of the cut.

### Bottom line
Web-first PWA; MediaPipe on-device (free, private, 478 landmarks) + transparent ratio-based classification with confidence scores; ship recommendations before renders; add generative try-on via a hosted instruction-editing model (~$0.04/image) and graduate to self-hosted Stable-Hair v2 for exact reference transfer and multi-view once volume and quality demands justify it. LGPD compliance is a design feature, not a checkbox — on-device analysis plus consent-gated, short-TTL uploads keeps you clean and is marketable.
