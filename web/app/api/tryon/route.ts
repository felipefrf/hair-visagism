// Generative try-on endpoint.
// Provider: FLUX.1 Kontext via fal.ai (primary) — instruction-based image
// editing with strong identity preservation (~$0.04/image). The user photo
// arrives as a data URL, is forwarded to the render provider, and is never
// written to our storage (LGPD: purpose-specific use, zero retention on our
// side).

import { fal } from "@fal-ai/client";
import { CATALOG } from "@/lib/catalog";

export const maxDuration = 60;

interface TryOnBody {
  image: string; // data URL
  styleId: string;
}

export async function POST(request: Request) {
  const key = process.env.FAL_KEY;
  if (!key) {
    return Response.json(
      {
        error:
          "Renderização não configurada neste ambiente (defina FAL_KEY). A análise e as recomendações continuam funcionando normalmente.",
      },
      { status: 503 }
    );
  }

  let body: TryOnBody;
  try {
    body = (await request.json()) as TryOnBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const style = CATALOG.find((s) => s.id === body.styleId);
  if (!style || typeof body.image !== "string" || !body.image.startsWith("data:image/")) {
    return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }
  // ~8MB guardrail on the base64 payload.
  if (body.image.length > 11_000_000) {
    return Response.json(
      { error: "Imagem grande demais — use uma foto de até ~8MB." },
      { status: 413 }
    );
  }

  fal.config({ credentials: key });

  const prompt =
    `Change ONLY the person's hairstyle to: ${style.renderPrompt}. ` +
    `Keep the exact same face, identity, skin tone, expression, lighting, ` +
    `background and clothing. Photorealistic result, natural hairline, ` +
    `hair texture must look real, no wig-like appearance.`;

  try {
    const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
      input: {
        prompt,
        image_url: body.image,
        guidance_scale: 3.5,
        output_format: "jpeg",
        safety_tolerance: "2",
      },
    });

    const imageUrl = (result.data as { images?: { url: string }[] })
      ?.images?.[0]?.url;
    if (!imageUrl) {
      return Response.json(
        { error: "O provedor não retornou imagem — tente novamente." },
        { status: 502 }
      );
    }
    return Response.json({ imageUrl });
  } catch (err) {
    console.error("tryon render failed", err);
    const status = (err as { status?: number })?.status;
    const detail = err instanceof Error ? err.message : String(err);
    if (status === 401 || status === 403 || /balance|credit|unauthorized|forbidden/i.test(detail)) {
      return Response.json(
        {
          error:
            "O provedor de renderização recusou a chamada — verifique se a FAL_KEY é válida e se há créditos na conta fal.ai (Billing → Add funds).",
        },
        { status: 502 }
      );
    }
    return Response.json(
      { error: "Falha na renderização — tente novamente em instantes." },
      { status: 502 }
    );
  }
}
