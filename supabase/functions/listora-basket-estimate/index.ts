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

  const requestId = crypto.randomUUID();
  let stage = "configuration";
  let diagnosticCode: string | null = null;
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!geminiKey) return json({ error: "O serviço de estimativa não está configurado (GEMINI_API_KEY)." }, 503);
    if (!supabaseUrl || !serviceKey) return json({ error: "O catálogo internacional não está configurado no Supabase." }, 503);

    stage = "authentication";
    const authorization = req.headers.get("Authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    if (!accessToken) return json({ error: "Inicia sessão para utilizar esta funcionalidade." }, 401);
    const authResponse = await fetch(new URL("/auth/v1/user", supabaseUrl), {
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000)
    });
    if (!authResponse.ok) return json({ error: "Sessão inválida. Volta a iniciar sessão." }, 401);
    const authUser = await authResponse.json();
    if (!authUser?.id) return json({ error: "Sessão inválida." }, 401);

    const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
    stage = "rate_limit_check";
    const rateResponse = await fetch(new URL("/rest/v1/rpc/consume_ai_rate_limit", supabaseUrl), {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ p_user_id: authUser.id, p_feature_key: "basket_estimate", p_limit: 10, p_window_seconds: 60 }),
      signal: AbortSignal.timeout(10000)
    });
    if (!rateResponse.ok) throw new Error("Não foi possível validar o limite de utilização.");
    const rateRows = await rateResponse.json();
    if (rateRows?.[0]?.allowed === false) return json({ error: "Estás a fazer demasiadas pesquisas num curto espaço de tempo. Aguarda um minuto e tenta novamente.", code: "rate_limited", retryAfter: rateRows[0].retry_after_s }, 429);

    stage = "request_validation";
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
    stage = "country_catalogue";
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

    stage = "supermarket_catalogue";
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
      "You are a careful grocery product matcher and basket price ESTIMATOR for the specified country and supermarket.",
      "LIVE RESEARCH: You have Google Search grounding. For each supermarket, actively search the official supermarket website and reliable indexed product pages for the requested product before estimating. Prioritize the supermarket website/domain supplied in the supermarket data. Search using the exact product name, brand, variant and package size. Use live search evidence to identify product names, package sizes and visible prices. Do not claim stock or availability unless the source explicitly confirms it. If no reliable product or price evidence is found, you may provide a clearly labelled market estimate only when responsible; otherwise use no_reliable_match. Never invent URLs, promotions or catalogue references.",
      "",
      "PRODUCT MATCHING - follow this order independently for EVERY basket item and EVERY supermarket:",
      "1. EXACT MATCH: same brand, product name/line, variant, relevant attributes and package size.",
      "2. SAME BRAND VARIANT: same brand and product family, closest available variant or package size.",
      "3. EQUIVALENT OTHER BRAND: only if no credible same-brand match exists; choose the closest product with the same product type, variant, quality tier and use.",
      "4. NO RELIABLE MATCH: if you cannot identify a credible equivalent, use no_reliable_match and do not invent a product or price.",
      "Never jump to a competing brand when an exact or credible same-brand match is plausible. Never substitute a different product category. Do not silently treat a different size as the same pack: report its actual package size and normalize the price by kg, litre or unit where possible.",
      "Brand, variety, fat percentage, dietary type, origin, preparation, freshness/frozen status and pack size are meaningful attributes when present in the requested name. Preserve them in matching.",
      "Do not assume the same product or price exists in every supermarket. Match each supermarket separately. Store price positioning may inform a cautious estimate, but must never override product equivalence.",
      "",
      "PRICE ESTIMATION:",
      "PRICE EVIDENCE: Prefer a current price found through Google Search on the supermarket official website. Distinguish observed prices from estimates in matchingNotes: identify whether the price was found online or estimated. Never present an estimated price as a verified price. Do not assume promotions or loyalty discounts apply. If a live price is not found, estimate cautiously only when there is enough evidence about the exact product or a credible equivalent; otherwise return no_reliable_match. Confidence must reflect the strength and freshness of evidence.",
      "Return one result for each supplied supermarket. Include every requested basket item exactly once and preserve requestedName, quantity and unit. For matched products return matchedProductName, brand when identifiable, packageSize, normalizedUnit (kg, L or un), matchType, matchConfidence, matchingNotes, estimatedUnitPrice and estimatedSubtotal. estimatedSubtotal is the total for the requested quantity. Use matchType exact_match, same_brand_variant, equivalent_other_brand or no_reliable_match. Use low, medium or high for confidence fields.",
      "If ANY basket item has no reliable match or no responsible price estimate, set the supermarket status to insufficient_data and do not provide a misleading complete basket total. Still return the item-level matching results for transparency. Only use status estimated when every requested item has a credible match and price.",
      "For status estimated, the sum of item estimatedSubtotal values must approximately equal estimatedTotal. Keep rangeMin <= estimatedTotal <= rangeMax. Use the exact currency supplied.",
      "",
      "Country: " + country.name + " (" + country.code + "). Currency: " + currency + ". Language: " + country.default_language + ".",
      "Basket (user's exact requested products): " + JSON.stringify(basket),
      "Selected supermarkets: " + JSON.stringify(stores.map((store: any) => ({
        name: store.name,
        website: store.website,
        pricePosition: store.price_position
      }))),
      "Return valid JSON only, using this schema: {stores:[{name,status,estimatedTotal,rangeMin,rangeMax,confidence,notes,items:[{requestedName,matchedProductName,brand,packageSize,normalizedUnit,matchType,matchConfidence,matchingNotes,quantity,unit,estimatedUnitPrice,estimatedSubtotal,confidence}]}]}. Use null for unavailable numeric prices and omit no requested items."
    ].join("\n");

    stage = "gemini_request";
    const ai = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + encodeURIComponent(geminiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 16000,
            thinkingConfig: { thinkingLevel: "medium" }
          }
        }),
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(90000)])
      }
    );

    stage = "gemini_response";
    const payload = await ai.json().catch(() => ({}));
    if (!ai.ok) {
      const upstreamStatus = ai.status;
      console.error("Gemini basket estimate failed:", { status: upstreamStatus, message: payload?.error?.message || "Unknown upstream error" });
      if (upstreamStatus === 429) {
        return json({ error: "O serviço de pesquisa de preços está temporariamente sobrecarregado. Aguarda um pouco e tenta novamente.", code: "gemini_rate_limited" }, 503);
      }
      return json({
        error: upstreamStatus >= 500
          ? "O serviço de pesquisa de preços está temporariamente indisponível. Tenta novamente dentro de alguns instantes."
          : "O serviço de pesquisa de preços rejeitou o pedido. Revê os produtos e tenta novamente.",
        code: "gemini_upstream_error"
      }, 502);
    }
    stage = "gemini_parse";
    const candidate = payload?.candidates?.[0];
    const raw = candidate?.content?.parts?.map((part: any) => part.text || "").join("") || "";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return json({ error: "Não foi possível interpretar a estimativa." }, 502); }

    stage = "result_normalization";
    const known = new Map(stores.map((store: any) => [String(store.name).toLocaleLowerCase(), store]));
    const results = (Array.isArray(parsed?.stores) ? parsed.stores : []).map((estimate: any) => {
      const name = String(estimate?.name || "").trim();
      const store = known.get(name.toLocaleLowerCase());
      if (!store) return null;

      const itemResults = basket.map((item: any) => {
        const matched = Array.isArray(estimate.items)
          ? estimate.items.find((entry: any) =>
              String(entry?.requestedName || entry?.name || "").trim().toLocaleLowerCase() === item.name.toLocaleLowerCase()
            )
          : null;
        const matchTypes = ["exact_match", "same_brand_variant", "equivalent_other_brand", "no_reliable_match"];
        const matchType = matchTypes.includes(matched?.matchType) ? matched.matchType : "no_reliable_match";
        const unitPrice = Number(matched?.estimatedUnitPrice);
        const subtotal = Number(matched?.estimatedSubtotal);
        const validPrice = matchType !== "no_reliable_match" &&
          Number.isFinite(unitPrice) && unitPrice > 0 &&
          Number.isFinite(subtotal) && subtotal > 0;
        const validMatch = validPrice && String(matched?.matchedProductName || "").trim().length > 0;
        return {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          matchedProductName: validMatch ? String(matched.matchedProductName).trim().slice(0, 140) : null,
          brand: validMatch && matched.brand ? String(matched.brand).trim().slice(0, 70) : null,
          packageSize: validMatch && matched.packageSize ? String(matched.packageSize).trim().slice(0, 50) : null,
          normalizedUnit: validMatch && ["kg", "L", "un"].includes(matched.normalizedUnit) ? matched.normalizedUnit : null,
          matchType: validMatch ? matchType : "no_reliable_match",
          matchConfidence: validMatch && ["low", "medium", "high"].includes(matched.matchConfidence)
            ? matched.matchConfidence : "low",
          matchingNotes: String(matched?.matchingNotes || "").slice(0, 180),
          estimatedUnitPrice: validMatch ? round(unitPrice) : null,
          estimatedSubtotal: validMatch ? round(subtotal) : null,
          confidence: validMatch && ["low", "medium", "high"].includes(matched.confidence) ? matched.confidence : "low"
        };
      });

      const hasCompleteMatches = itemResults.length === basket.length &&
        itemResults.every((item: any) => item.matchType !== "no_reliable_match" &&
          Number.isFinite(item.estimatedSubtotal));
      if (!hasCompleteMatches || estimate.status === "insufficient_data") {
        return {
          name: store.name,
          website: store.website,
          status: "insufficient_data",
          confidence: "low",
          notes: String(estimate.notes || "Não foi possível identificar todos os produtos com confiança suficiente.").slice(0, 180),
          items: itemResults
        };
      }

      const modelTotal = Number(estimate.estimatedTotal);
      const min = Number(estimate.rangeMin);
      const max = Number(estimate.rangeMax);
      const itemizedTotal = round(itemResults.reduce((sum: number, item: any) => sum + item.estimatedSubtotal, 0));
      if (![modelTotal, min, max, itemizedTotal].every(Number.isFinite) ||
          modelTotal <= 0 || itemizedTotal <= 0 || min <= 0 || max > 100000000 ||
          min > max || Math.abs(modelTotal - itemizedTotal) > Math.max(0.5, itemizedTotal * 0.15)) {
        return {
          name: store.name, website: store.website, status: "insufficient_data", confidence: "low",
          notes: "Os preços por produto e o total do cabaz não são suficientemente consistentes.", items: itemResults
        };
      }
      // Derive the displayed total from the itemized prices so the breakdown always adds up.
      const total = itemizedTotal;
      return {
        name: store.name,
        website: store.website,
        status: "estimated",
        estimatedTotal: total,
        estimatedRange: { min: round(Math.min(min, total)), max: round(Math.max(max, total)) },
        confidence: ["low", "medium", "high"].includes(estimate.confidence) ? estimate.confidence : "low",
        notes: String(estimate.notes || "").slice(0, 180),
        items: itemResults
      };
    }).filter(Boolean);

    if (!results.length) return json({ error: "Não foi possível obter uma comparação válida para os supermercados selecionados." }, 502);

    if (req.signal.aborted) {
      console.info("Basket estimate cancelled by client before completion:", { requestId });
      return json({ error: "A comparação foi cancelada.", code: "request_cancelled" }, 499);
    }

    return json({
      generatedAt: new Date().toISOString(),
      country: { code: country.code, name: country.name },
      currency: country.currency_code,
      currencyLocale: country.currency_locale,
      method: "ai_grounded_estimate",
      model: "gemini-3.8-flash",
      groundingSources: (candidate?.groundingMetadata?.groundingChunks || [])
        .map((chunk: any) => chunk?.web)
        .filter((web: any) => web?.uri)
        .map((web: any) => ({ title: String(web.title || web.uri).slice(0, 160), url: web.uri }))
        .filter((source: any, index: number, all: any[]) => all.findIndex((entry: any) => entry.url === source.url) === index)
        .slice(0, 20),
      stores: results,
      disclaimer: "Estimativa recolhida por IA. O valor apresentado pode não corresponder exatamente ao preço de catálogo ou incluir todos os descontos e promoções aplicáveis."
    });
  } catch (error) {
    if (req.signal.aborted) {
      console.info("Basket estimate upstream work aborted after client cancellation.");
      return json({ error: "A comparação foi cancelada.", code: "request_cancelled" }, 499);
    }
    const message = error instanceof Error ? error.message : String(error || "Unknown error");
    const timedOut = /timed out|timeout|abort/i.test(message);
    console.error("listora-basket-estimate error:", { requestId, stage, diagnosticCode, message, name: error instanceof Error ? error.name : typeof error });
    return json({
      error: timedOut
        ? "A pesquisa de preços demorou mais do que o esperado. Tenta novamente; não perdeste a tua lista."
        : "Ocorreu um erro ao consultar os preços. Tenta novamente dentro de alguns instantes.",
      code: timedOut ? "estimate_timeout" : "estimate_internal_error",
      requestId,
      stage,
      diagnosticCode
    }, timedOut ? 504 : 500);
  }
});
