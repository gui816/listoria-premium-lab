// Securely extract shopping-list items from dictated text or a photo.
// Configure GEMINI_API_KEY as a Supabase secret before deploying.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "O serviço de IA não está configurado. Confirma o segredo GEMINI_API_KEY no Supabase." }, 503);

  try {
    const body = await req.json();
    const text = String(body?.text || "").trim().slice(0, 12000);
    const mimeType = String(body?.mimeType || "");
    const fileData = String(body?.fileData || "");

    if (!text && !fileData) return json({ error: "Envia uma fotografia ou dita os produtos primeiro." }, 400);
    if (fileData) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
        return json({ error: "Formato de imagem não suportado. Usa JPG, PNG ou WebP." }, 400);
      }
      if (fileData.length > 14_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(fileData)) {
        return json({ error: "A imagem está vazia ou excede o limite permitido. Tenta uma imagem mais pequena." }, 400);
      }
    }

    const prompt = [
      "You extract shopping-list items. Return ONLY valid JSON in this exact shape: {\"items\":[{\"name\":\"product name\",\"quantity\":1}]} .",
      "Identify only purchasable product names and quantities explicitly stated or clearly written. Do not invent products, brands, units, prices, headings, notes, or recipes.",
      "If no quantity is present, use quantity 1. Quantity must be an integer from 1 to 999.",
      "Preserve the language of each product and use concise product names. Merge obvious duplicate mentions by adding quantities.",
      "If text/image is unclear, omit uncertain entries. Maximum 60 items.",
      text ? "Shopping list dictated by the user: " + text : "Read the handwritten or printed shopping list in the attached image."
    ].join("\n");

    const parts: Array<Record<string, unknown>> = [{ text: prompt }];
    if (fileData) parts.push({ inlineData: { mimeType, data: fileData } });
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: { items: { type: "ARRAY", maxItems: 60, items: {
              type: "OBJECT",
              properties: { name: { type: "STRING" }, quantity: { type: "INTEGER" } },
              required: ["name", "quantity"],
              propertyOrdering: ["name", "quantity"]
            }}},
            required: ["items"],
            propertyOrdering: ["items"]
          },
          temperature: 0.1
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message;
      return json({ error: detail || "A API Gemini devolveu um erro (" + response.status + "). Confirma o acesso ao modelo." }, 502);
    }
    const modelText = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(modelText.replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "").trim());
    } catch {
      return json({ error: "A IA não devolveu uma lista válida. Tenta novamente com uma fotografia mais nítida." }, 502);
    }
    const source = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown })?.items;
    if (!Array.isArray(source)) return json({ error: "A IA não devolveu uma lista válida." }, 502);
    const items = source.map((item: { name?: unknown; product?: unknown; quantity?: unknown }) => ({
      name: String(item?.name || item?.product || "").trim().replace(/\s+/g, " ").slice(0, 100),
      quantity: Math.max(1, Math.min(999, Number.parseInt(String(item?.quantity ?? 1), 10) || 1))
    })).filter((item: { name: string }) => item.name).slice(0, 60);
    return json({ items });
  } catch (error) {
    console.error("listora-list-extract error:", error);
    return json({ error: "Não foi possível interpretar a lista. Tenta novamente." }, 500);
  }
});
