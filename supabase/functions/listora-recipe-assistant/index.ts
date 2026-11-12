// Generate practical recipes using a family's existing inventory.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "O serviço de IA não está configurado. Confirma o segredo GEMINI_API_KEY no Supabase." }, 503);

  try {
    const body = await req.json();
    const inventory = Array.isArray(body?.inventory) ? body.inventory.slice(0, 60).map((item: Record<string, unknown>) => ({
      name: String(item?.name || "").trim().slice(0, 100),
      quantity: Math.max(0, Math.min(999, Number(item?.quantity) || 0)),
      location: String(item?.location || "").slice(0, 40),
      expiryDate: item?.expiryDate ? String(item.expiryDate).slice(0, 20) : null,
    })).filter((item: { name: string }) => item.name) : [];
    const request = String(body?.request || "").trim().slice(0, 500);
    const imagesInput = Array.isArray(body?.images) ? body.images : [];
    if (imagesInput.length > 3) return json({ error: "Podes enviar no máximo 3 fotografias por pesquisa." }, 400);
    const images: { mimeType: string; data: string }[] = imagesInput.map((image: Record<string, unknown>) => ({
      mimeType: String(image?.mimeType || ""),
      data: String(image?.data || ""),
    }));
    const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    for (const image of images) {
      if (!allowedImageTypes.has(image.mimeType) || !image.data || image.data.length > 940_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) {
        return json({ error: "Uma fotografia é inválida ou demasiado grande. Usa imagens JPG, PNG ou WebP até cerca de 700 KB." }, 400);
      }
    }
    if (images.reduce((total, image) => total + image.data.length, 0) > 2_820_000) {
      return json({ error: "O conjunto de fotografias é demasiado grande. Tenta enviar menos imagens." }, 413);
    }
    const language = String(body?.language || "pt-PT").slice(0, 12);
    if (!inventory.length && !request && !images.length) return json({ error: "Adiciona produtos em casa, envia fotografias ou indica o que gostarias de cozinhar." }, 400);

    const prompt = [
      "You are Listoria, a practical home cooking assistant. Suggest exactly 3 realistic recipes.",
      "Use the household inventory and any supplied food photos as sources. Identify visible ingredients from photos, but do not guess hidden contents, quantities, freshness, expiry dates or food safety. Treat photo identification as tentative and explain uncertainty in the recipe tip when relevant. Prefer recipes that use more confirmed existing ingredients and, when expiry dates are supplied, prioritize items expiring soon.",
      "Never claim an ingredient is available unless it clearly matches an inventory item. Set available=true only for ingredients covered by inventory; otherwise false.",
      "Do not invent inventory quantities. If an available ingredient quantity is unclear or insufficient, mark it available=false.",
      "Missing ingredients must be ordinary, reasonably easy-to-buy ingredients. Avoid requiring specialist equipment.",
      "Keep recipes family-friendly, affordable and practical. Vary the suggestions. Respect dietary preferences or constraints in the user's request as far as possible; if a request is unsafe or impossible, explain briefly in the description.",
      "Do not assume allergies are absent. Do not make medical or nutrition claims. Include quantities with common units in the requested language.",
      "Return concise, actionable steps, 3 to 7 per recipe. Use the requested language for every user-facing string.",
      "Return only valid JSON with this exact shape: {\"recipes\":[{\"id\":string,\"title\":string,\"description\":string,\"timeMinutes\":number,\"servings\":number,\"ingredients\":[{\"name\":string,\"quantity\":string,\"available\":boolean}],\"steps\":[string],\"tip\":string}]}. Include exactly 3 recipes. Do not add markdown fences or extra keys.",
      "Requested language: " + language,
      "Household inventory JSON: " + JSON.stringify(inventory),
      "User request: " + (request || "Suggest varied everyday meals using what is available.")
    ].join("\n\n");

    const imageParts = images.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.data } }));
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, ...imageParts] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.65
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message;
      return json({ error: detail || "A API Gemini devolveu um erro (" + response.status + ")." }, 502);
    }
    const modelText = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(modelText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
    } catch {
      return json({ error: "A IA não devolveu receitas num formato válido. Tenta novamente." }, 502);
    }
    const source = (parsed as { recipes?: unknown })?.recipes;
    if (!Array.isArray(source)) return json({ error: "Não foi possível preparar sugestões de receitas." }, 502);
    const recipes = source.slice(0, 3).map((recipe: Record<string, unknown>, index: number) => ({
      id: String(recipe?.id || index).slice(0, 40),
      title: String(recipe?.title || "").trim().slice(0, 90),
      description: String(recipe?.description || "").trim().slice(0, 220),
      timeMinutes: Math.max(5, Math.min(240, Number(recipe?.timeMinutes) || 30)),
      servings: Math.max(1, Math.min(12, Number(recipe?.servings) || 2)),
      ingredients: (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).slice(0, 24).map((item: Record<string, unknown>) => ({
        name: String(item?.name || "").trim().slice(0, 100),
        quantity: String(item?.quantity || "").trim().slice(0, 50),
        available: item?.available === true,
      })).filter((item: { name: string }) => item.name),
      steps: (Array.isArray(recipe?.steps) ? recipe.steps : []).map((step: unknown) => String(step).trim().slice(0, 500)).filter(Boolean).slice(0, 8),
      tip: String(recipe?.tip || "").trim().slice(0, 220),
    })).filter((recipe: { title: string; ingredients: unknown[]; steps: unknown[] }) => recipe.title && recipe.ingredients.length && recipe.steps.length);
    if (!recipes.length) return json({ error: "Não foram encontradas receitas adequadas. Tenta alterar o pedido." }, 422);
    return json({ recipes });
  } catch (error) {
    console.error("listora-recipe-assistant error:", error);
    return json({ error: "Não foi possível gerar receitas. Tenta novamente." }, 500);
  }
});
