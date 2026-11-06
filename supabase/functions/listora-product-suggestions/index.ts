import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const safeHttpsUrl = (value: unknown) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "O serviço de sugestões não está configurado. Confirma o segredo GEMINI_API_KEY no Supabase." }, 503);

    const body = await req.json();
    const query = String(body?.query || "").trim().replace(/\s+/g, " ").slice(0, 500);
    const countryCode = String(body?.countryCode || "PT").trim().toUpperCase();
    const language = String(body?.language || "pt").toLowerCase() === "en" ? "English" : "Portuguese";
    if (query.length < 3) return json({ error: "Descreve o que procuras (pelo menos 3 caracteres)." }, 400);
    if (!/^[A-Z]{2}$/.test(countryCode)) return json({ error: "País inválido." }, 400);

    const existingItems = (Array.isArray(body?.existingItems) ? body.existingItems : [])
      .slice(0, 60)
      .map((item: any) => String(item?.name || "").trim().replace(/\s+/g, " ").slice(0, 100))
      .filter(Boolean);

    const prompt = [
      "You are Listoria's grocery product discovery assistant.",
      "TASK: Recommend 6 to 8 real grocery products that match the user's request and are relevant to the country.",
      "USER REQUEST: " + query,
      "COUNTRY: " + countryCode + ". RESPONSE LANGUAGE: " + language + ".",
      "CURRENT SHOPPING LIST (avoid exact or near duplicates): " + JSON.stringify(existingItems),
      "",
      "RESEARCH REQUIREMENTS:",
      "- Use Google Search grounding to find real products and prioritize official supermarket, manufacturer and brand product pages in the specified country.",
      "- Prefer products that are actually sold in this country. A product page is evidence of a product, NOT evidence of current stock or current price.",
      "- Do not invent brands, product names, certifications, ingredients, allergens, nutrition claims, availability or URLs.",
      "- For organic, gluten-free, lactose-free, vegan, allergen-free, high-protein or other regulated/nutrition claims, only state the claim when supported by a reliable source. If not verifiable, do not include that claim in attributes and explain the limitation in reason.",
      "- Include a mix of product types/categories when the request allows it; avoid returning near-identical variants.",
      "- Do not return products already on the current shopping list or close spelling variants.",
      "- If fewer than 6 relevant real products can be supported by sources, return fewer. Never pad with invented suggestions.",
      "- Return a concise reason explaining why each product matches the request.",
      "- Use a direct product page URL only when found in search evidence; otherwise use an empty string.",
      "- Confidence: high when the product and relevant requested characteristics are supported by sources; medium when the product is real but some matching detail is uncertain; low when evidence is weak. Prefer omitting low-confidence suggestions.",
      "",
      "Return valid JSON with this shape: { suggestions: [{ name, brand, category, attributes, reason, url, sourceName, confidence }] }."
    ].join("\n");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        }),
        signal: AbortSignal.timeout(45000)
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: payload?.error?.message || "O Gemini não conseguiu pesquisar produtos (" + response.status + ")." }, 502);
    const candidate = payload?.candidates?.[0];
    const raw = candidate?.content?.parts?.map((part: any) => part.text || "").join("") || "";
    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch { return json({ error: "Não foi possível interpretar as sugestões. Tenta novamente." }, 502); }

    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks.map((chunk: any) => ({
      title: String(chunk?.web?.title || "").slice(0, 160),
      url: safeHttpsUrl(chunk?.web?.uri)
    })).filter((source: any) => source.url).filter((source: any, index: number, all: any[]) =>
      all.findIndex((entry: any) => entry.url === source.url) === index
    ).slice(0, 8);
    const groundedUrls = new Set(sources.map((source: any) => source.url));
    const seen = new Set(existingItems.map((name) => name.toLocaleLowerCase()));
    const suggestions = (Array.isArray(parsed?.suggestions) ? parsed.suggestions : [])
      .slice(0, 8)
      .map((entry: any, index: number) => {
        const name = String(entry?.name || "").trim().replace(/\s+/g, " ").slice(0, 140);
        const confidence = ["high", "medium", "low"].includes(entry?.confidence) ? entry.confidence : "low";
        const attributes = Array.isArray(entry?.attributes)
          ? entry.attributes.map((value: unknown) => String(value).trim().slice(0, 50)).filter(Boolean).slice(0, 6)
          : [];
        return {
          id: "suggestion-" + index,
          name,
          brand: String(entry?.brand || "").trim().slice(0, 80),
          category: String(entry?.category || "").trim().slice(0, 60),
          attributes,
          reason: String(entry?.reason || "").trim().slice(0, 240),
          url: (() => { const candidateUrl = safeHttpsUrl(entry?.url); return groundedUrls.has(candidateUrl) ? candidateUrl : ""; })(),
          sourceName: (() => { const found = sources.find((source: any) => source.url === (safeHttpsUrl(entry?.url) && groundedUrls.has(safeHttpsUrl(entry?.url)) ? safeHttpsUrl(entry?.url) : "")); if (found?.title) return found.title.slice(0, 100); try { return new URL(found?.url || "").hostname; } catch { return ""; } })(),
          confidence
        };
      })
      .filter((entry: any) => entry.name && !seen.has(entry.name.toLocaleLowerCase()) && entry.confidence !== "low");

    return json({
      countryCode,
      suggestions,
      sources,
      disclaimer: "As sugestões são indicativas e devem ser verificadas na embalagem e na página do vendedor antes da compra.",
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro inesperado ao sugerir produtos." }, 500);
  }
});
