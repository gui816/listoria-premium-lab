import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const round = (value: number) => Math.round(value * 100) / 100;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!geminiKey) return json({ error: "O serviço de estimativa não está configurado (GEMINI_API_KEY)." }, 503);
    if (!supabaseUrl || !serviceKey) return json({ error: "O catálogo internacional não está configurado no Supabase." }, 503);

    const body = await req.json();
    const countryCode = String(body?.countryCode || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) return json({ error: "Seleciona um país válido." }, 400);

    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length || items.length > 60) return json({ error: "A lista deve conter entre 1 e 60 artigos por comprar." }, 400);
    const basket = items.map((item: any) => ({
      name: String(item?.name || "").trim().replace(/\s+/g, " ").slice(0, 100),
      quantity: Math.max(1, Math.min(999, Number(item?.quantity) || 1)),
      unit: String(item?.unit || "un").slice(0, 12)
    })).filter((item: any) => item.name);
    if (!basket.length) return json({ error: "Não foram encontrados artigos válidos." }, 400);

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const countryUrl = new URL("/rest/v1/countries", supabaseUrl);
    countryUrl.search = new URLSearchParams({
      select: "code,name,currency_code,currency_locale,default_language",
      code: `eq.${countryCode}`,
      enabled: "eq.true",
      limit: "1"
    }).toString();
    const countryResponse = await fetch(countryUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!countryResponse.ok) throw new Error("Não foi possível consultar o catálogo de países.");
    const countries = await countryResponse.json();
    const country = countries?.[0];
    if (!country) return json({ error: "Este país ainda não está disponível no Listora." }, 404);

    const supermarketUrl = new URL("/rest/v1/supermarkets", supabaseUrl);
    supermarketUrl.search = new URLSearchParams({
      select: "id,name,price_position,website,display_order",
      country_code: `eq.${countryCode}`,
      enabled: "eq.true",
      order: "display_order.asc",
      limit: "30"
    }).toString();
    const supermarketResponse = await fetch(supermarketUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!supermarketResponse.ok) throw new Error("Não foi possível consultar os supermercados deste país.");
    const catalogue = await supermarketResponse.json();
    if (!Array.isArray(catalogue) || !catalogue.length) {
      return json({ error: "Ainda não existem supermercados configurados para este país." }, 404);
    }

    const requestedNames = Array.isArray(body?.supermarkets)
      ? body.supermarkets.map((name: unknown) => String(name).trim().toLocaleLowerCase())
      : [];
    const selected = requestedNames.length
      ? catalogue.filter((store: any) => requestedNames.includes(String(store.name).toLocaleLowerCase()))
      : catalogue.slice(0, 5);
    const stores = (selected.length ? selected : catalogue.slice(0, 5)).slice(0, 12);
    const currency = country.currency_code;
    const prompt = [
      "You are estimating a grocery basket for the specified country. You do NOT have live catalogue or store prices.",
      "Estimate typical basket totals using general market knowledge, the country's currency, local product sizes and the supplied store positioning.",
      "Do not claim prices were checked, do not invent promotions, and do not guarantee savings. If you cannot estimate responsibly, set status to insufficient_data.",
      "Return one result for each supplied supermarket, in the exact currency provided. Keep min <= total <= max. Confidence must be low, medium or high. For every supermarket, also return an itemized estimate for EVERY basket item, preserving its name, quantity and unit. Each item must include estimatedUnitPrice and estimatedSubtotal in the selected currency, plus confidence. The sum of item subtotals should approximately match estimatedTotal.",
      "Country: " + country.name + " (" + country.code + "). Currency: " + currency + ". Language: " + country.default_language + ".",
      "Basket: " + JSON.stringify(basket),
      "Selected supermarkets: " + JSON.stringify(stores.map((store: any) => ({
        name: store.name,
        pricePosition: store.price_position
      }))),
      "Return JSON: {stores:[{name,status,estimatedTotal,rangeMin,rangeMax,confidence,notes,items:[{name,quantity,unit,estimatedUnitPrice,estimatedSubtotal,confidence}]}]}."
    ].join("\n");

    const ai = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(geminiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            responseSchema: {
              type: "OBJECT",
              properties: {
                stores: {
                  type: "ARRAY",
                  maxItems: 12,
                  items: {
                    type: "OBJECT",
                    properties: {
                      name: { type: "STRING" },
                      status: { type: "STRING", enum: ["estimated", "insufficient_data"] },
                      estimatedTotal: { type: "NUMBER" },
                      rangeMin: { type: "NUMBER" },
                      rangeMax: { type: "NUMBER" },
                      confidence: { type: "STRING", enum: ["low", "medium", "high"] },
                      notes: { type: "STRING" },
                      items: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            name: { type: "STRING" },
                            quantity: { type: "NUMBER" },
                            unit: { type: "STRING" },
                            estimatedUnitPrice: { type: "NUMBER" },
                            estimatedSubtotal: { type: "NUMBER" },
                            confidence: { type: "STRING", enum: ["low", "medium", "high"] }
                          },
                          required: ["name", "quantity", "unit", "estimatedUnitPrice", "estimatedSubtotal", "confidence"],
                          propertyOrdering: ["name", "quantity", "unit", "estimatedUnitPrice", "estimatedSubtotal", "confidence"]
                        }
                      }
                    },
                    required: ["name", "status", "confidence"],
                    propertyOrdering: ["name", "status", "estimatedTotal", "rangeMin", "rangeMax", "confidence", "notes", "items"]
                  }
                }
              },
              required: ["stores"],
              propertyOrdering: ["stores"]
            }
          }
        }),
        signal: AbortSignal.timeout(45000)
      }
    );

    const payload = await ai.json().catch(() => ({}));
    if (!ai.ok) return json({ error: payload?.error?.message || "O serviço de estimativa devolveu um erro." }, 502);
    const raw = payload?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return json({ error: "Não foi possível interpretar a estimativa." }, 502); }

    const known = new Map(stores.map((store: any) => [String(store.name).toLocaleLowerCase(), store]));
    const results = (Array.isArray(parsed?.stores) ? parsed.stores : []).map((estimate: any) => {
      const name = String(estimate?.name || "").trim();
      const store = known.get(name.toLocaleLowerCase());
      if (!store) return null;
      if (estimate.status === "insufficient_data") {
        return { name: store.name, website: store.website, status: "insufficient_data", confidence: "low" };
      }
      const total = Number(estimate.estimatedTotal);
      const min = Number(estimate.rangeMin);
      const max = Number(estimate.rangeMax);
      if (![total, min, max].every(Number.isFinite) || min <= 0 || min > total || total > max || max > 100000000) {
        return { name: store.name, website: store.website, status: "insufficient_data", confidence: "low" };
      }
      return {
        name: store.name,
        website: store.website,
        status: "estimated",
        estimatedTotal: round(total),
        estimatedRange: { min: round(min), max: round(max) },
        confidence: ["low", "medium", "high"].includes(estimate.confidence) ? estimate.confidence : "low",
        notes: String(estimate.notes || "").slice(0, 180),
        items: basket.map((item: any) => {
          const matched = Array.isArray(estimate.items)
            ? estimate.items.find((entry: any) => String(entry?.name || "").trim().toLocaleLowerCase() === item.name.toLocaleLowerCase())
            : null;
          const unitPrice = Number(matched?.estimatedUnitPrice);
          const subtotal = Number(matched?.estimatedSubtotal);
          const valid = Number.isFinite(unitPrice) && unitPrice >= 0 && Number.isFinite(subtotal) && subtotal >= 0;
          return {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            estimatedUnitPrice: valid ? round(unitPrice) : null,
            estimatedSubtotal: valid ? round(subtotal) : null,
            confidence: ["low", "medium", "high"].includes(matched?.confidence) ? matched.confidence : "low"
          };
        })
      };
    }).filter(Boolean);

    return json({
      generatedAt: new Date().toISOString(),
      country: { code: country.code, name: country.name },
      currency: country.currency_code,
      currencyLocale: country.currency_locale,
      method: "ai_estimate",
      stores: results,
      disclaimer: "Estimativa gerada por IA. O valor apresentado pode não corresponder exatamente ao preço de catálogo ou incluir todos os descontos e promoções aplicáveis."
    });
  } catch (error) {
    console.error("listora-basket-estimate error:", error);
    return json({ error: "Não foi possível estimar o cabaz. Verifica a ligação e tenta novamente." }, 500);
  }
});
