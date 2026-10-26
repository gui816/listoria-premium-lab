// Supabase Edge Function: compare-basket
// Gemini Google Search grounding is used to discover price references.
// AI output is untrusted: each returned source URL must match a grounding chunk,
// and items without a verifiable source are discarded rather than assigned guessed prices.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const schema = {
  type: "OBJECT",
  properties: {
    market: { type: "STRING" },
    currency: { type: "STRING" },
    notes: { type: "ARRAY", items: { type: "STRING" } },
    retailers: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          storeOrArea: { type: "STRING" },
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                requestedProduct: { type: "STRING" },
                matchedProduct: { type: "STRING" },
                packageSize: { type: "STRING" },
                price: { type: ["NUMBER", "NULL"] },
                currency: { type: "STRING" },
                sourceUrl: { type: "STRING" },
                sourceName: { type: "STRING" },
                priceType: { type: "STRING" },
                observedAtText: { type: "STRING" },
                confidence: { type: "STRING" },
                caveat: { type: "STRING" },
              },
              required: ["requestedProduct", "matchedProduct", "packageSize", "price", "currency", "sourceUrl", "sourceName", "priceType", "observedAtText", "confidence", "caveat"],
            },
          },
        },
        required: ["name", "storeOrArea", "items"],
      },
    },
  },
  required: ["market", "currency", "notes", "retailers"],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json(503, { error: "Gemini não está configurada no servidor. Define o secret GEMINI_API_KEY no projeto de testes." });

  try {
    const body = await req.json();
    const market = typeof body.market === "string" ? body.market.slice(0, 2).toUpperCase() : "PT";
    const postalCode = typeof body.postalCode === "string" ? body.postalCode.trim().slice(0, 24) : "";
    const locale = typeof body.locale === "string" ? body.locale.slice(0, 32) : "pt-PT";
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!rawItems.length || rawItems.length > 40) {
      return json(400, { error: "Envia entre 1 e 40 produtos por comparação." });
    }

    const items = rawItems.map((item: any) => ({
      name: String(item?.name ?? "").trim().slice(0, 120),
      quantity: Math.max(1, Math.min(99, Number(item?.quantity) || 1)),
      detail: String(item?.detail ?? "").trim().slice(0, 120),
    })).filter((item: any) => item.name.length > 0);
    if (!items.length) return json(400, { error: "Não foram encontrados nomes de produtos válidos." });

    const prompt = `You are a careful supermarket price research assistant. Research real, currently published grocery prices using Google Search grounding. Do not invent, infer, average, or fill missing prices. A price is usable only when a source page clearly supports that product and price. Prefer retailer-owned pages and current catalogues. If exact product/pack size is unavailable, set price to null and explain the gap. Do not claim a store is nearby unless the evidence supports it. Treat postal code only as a locality hint, not as an exact address.

Market: ${market}
Locale: ${locale}
Postal code/locality hint: ${postalCode || "not provided"}
Requested basket JSON: ${JSON.stringify(items)}

Find up to 3 relevant supermarket chains that have source-backed prices in this market. Search in the market language. Compare like-for-like products only; don't silently substitute different pack sizes. For each item return a direct source page URL from the grounded search results when available. Never create URLs. A source URL must be one of the actual grounding sources. If no supported source price is found, price must be null and sourceUrl empty. Do not calculate a retailer total if any requested item has no reliable price. Return only JSON matching this schema:
${JSON.stringify(schema)}
Use priceType values such as "online", "in-store", "promotion", or "unknown". Use confidence values "high", "medium", or "low". observedAtText must state the page's date if actually shown, otherwise say "Data de publicação não confirmada". Do not pretend that the current request date is the observation date. Currency must be an ISO 4217 code. Notes must clearly disclose that web-search results can be incomplete and prices/availability must be checked with the retailer.`;

    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.2,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini request failed", response.status, errorText.slice(0, 1000));
      return json(502, { error: "A pesquisa de preços com Gemini falhou. Tenta novamente mais tarde." });
    }

    const result = await response.json();
    const candidate = result?.candidates?.[0];
    const text = candidate?.content?.parts?.map((part: any) => part.text ?? "").join("") ?? "";
    if (!text) return json(502, { error: "A Gemini não devolveu resultados estruturados." });

    let parsed: any;
    try { parsed = JSON.parse(text); } catch {
      return json(502, { error: "A resposta da Gemini não pôde ser validada." });
    }

    const metadata = candidate?.groundingMetadata ?? {};
    const chunks = (metadata.groundingChunks ?? [])
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web && isValidUrl(web.uri))
      .map((web: any) => ({ url: web.uri, title: String(web.title ?? new URL(web.uri).hostname) }));

    const allowedUrls = new Set(chunks.map((source: any) => source.url));
    const retailers = (Array.isArray(parsed.retailers) ? parsed.retailers : []).slice(0, 3).map((retailer: any) => {
      const checkedItems = (Array.isArray(retailer.items) ? retailer.items : []).map((item: any) => {
        const url = isValidUrl(item.sourceUrl) && allowedUrls.has(item.sourceUrl) ? item.sourceUrl : "";
        const price = typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0 && url
          ? Math.round(item.price * 10000) / 10000
          : null;
        return {
          requestedProduct: String(item.requestedProduct ?? "").slice(0, 120),
          matchedProduct: String(item.matchedProduct ?? "").slice(0, 180),
          packageSize: String(item.packageSize ?? "").slice(0, 80),
          price,
          currency: /^[A-Z]{3}$/.test(String(item.currency ?? "")) ? item.currency : String(parsed.currency ?? "EUR"),
          sourceUrl: url,
          sourceName: String(item.sourceName ?? "").slice(0, 120),
          priceType: String(item.priceType ?? "unknown").slice(0, 40),
          observedAtText: String(item.observedAtText ?? "Data de publicação não confirmada").slice(0, 120),
          confidence: ["high", "medium", "low"].includes(item.confidence) ? item.confidence : "low",
          caveat: String(item.caveat ?? "").slice(0, 240),
          quantity: items.find((requested: any) => requested.name.toLocaleLowerCase() === String(item.requestedProduct ?? "").toLocaleLowerCase())?.quantity ?? 1,
        };
      });
      const knownPrices = checkedItems.filter((item: any) => item.price !== null);
      const complete = checkedItems.length > 0 && checkedItems.every((item: any) => item.price !== null);
      const total = complete ? Math.round(checkedItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0) * 100) / 100 : null;
      return {
        name: String(retailer.name ?? "Supermercado").slice(0, 120),
        storeOrArea: String(retailer.storeOrArea ?? "Área não confirmada").slice(0, 120),
        items: checkedItems,
        matchedCount: knownPrices.length,
        itemCount: checkedItems.length,
        total,
        complete,
      };
    }).filter((retailer: any) => retailer.items.length > 0);

    return json(200, {
      market,
      currency: String(parsed.currency ?? "EUR"),
      notes: (Array.isArray(parsed.notes) ? parsed.notes : []).map((note: unknown) => String(note).slice(0, 300)).slice(0, 8),
      retailers,
      sources: chunks,
      searchQueries: (Array.isArray(metadata.webSearchQueries) ? metadata.webSearchQueries : []).slice(0, 12),
      generatedAt: new Date().toISOString(),
      disclaimer: "Resultados de pesquisa assistida por IA. Não são um feed oficial de preços. Confirma preço, embalagem, promoções e disponibilidade no site da loja antes de comprar.",
    });
  } catch (error) {
    console.error("compare-basket error", error);
    return json(500, { error: "Ocorreu um erro inesperado ao pesquisar os preços." });
  }
});
