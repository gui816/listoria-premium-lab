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
    const subscriptionUrl = new URL("/rest/v1/subscriptions", supabaseUrl);
    subscriptionUrl.search = new URLSearchParams({
      select: "status,current_period_end,past_due_grace_until",
      user_id: `eq.${authUser.id}`,
      order: "created_at.desc",
      limit: "1"
    }).toString();
    const subscriptionResponse = await fetch(subscriptionUrl, { headers: adminHeaders, signal: AbortSignal.timeout(10000) });
    if (!subscriptionResponse.ok) throw new Error("Não foi possível validar a subscrição Premium.");
    const subscriptions = await subscriptionResponse.json();
    const subscription = subscriptions?.[0];
    const now = Date.now();
    const graceActive = subscription?.status === "past_due" && subscription.past_due_grace_until && new Date(subscription.past_due_grace_until).getTime() > now;
    const paidCancellation = subscription?.status === "canceled" && subscription.current_period_end && new Date(subscription.current_period_end).getTime() > now;
    const hasPremium = Boolean(subscription && (["active", "trialing"].includes(subscription.status) || graceActive || paidCancellation));

    const demoUrl = new URL("/rest/v1/premium_demo_subscriptions", supabaseUrl);
    demoUrl.search = new URLSearchParams({ select: "status,current_period_end,cancel_at_period_end,past_due_grace_until", user_id: `eq.${authUser.id}`, limit: "1" }).toString();
    const demoResponse = await fetch(demoUrl, { headers: adminHeaders, signal: AbortSignal.timeout(10000) });
    if (!demoResponse.ok) throw new Error("Não foi possível validar o modo de demonstração Premium.");
    const demoRows = await demoResponse.json();
    const demoSubscription = demoRows?.[0];
    const demoGrace = demoSubscription?.status === "past_due" && demoSubscription.past_due_grace_until && new Date(demoSubscription.past_due_grace_until).getTime() > now;
    const demoPaidPeriod = demoSubscription?.cancel_at_period_end && demoSubscription.current_period_end && new Date(demoSubscription.current_period_end).getTime() > now;
    const hasDemoPremium = Boolean(demoSubscription && ((demoSubscription.status === "active" && (!demoSubscription.current_period_end || new Date(demoSubscription.current_period_end).getTime() > now)) || demoGrace || demoPaidPeriod));
    const hasAnyPremium = hasPremium || hasDemoPremium;

    const requestId = crypto.randomUUID();
    const rateResponse = await fetch(new URL("/rest/v1/rpc/consume_premium_rate_limit", supabaseUrl), {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ p_user_id: authUser.id, p_feature_key: "basket_estimate", p_request_id: requestId, p_limit: 10, p_window_seconds: 60 }),
      signal: AbortSignal.timeout(10000)
    });
    if (!rateResponse.ok) throw new Error("Não foi possível validar o limite de utilização.");
    const rateRows = await rateResponse.json();
    if (rateRows?.[0]?.allowed === false) return json({ error: "Estás a fazer demasiadas pesquisas num curto espaço de tempo. Aguarda um minuto e tenta novamente.", code: "rate_limited", retryAfter: rateRows[0].retry_after_seconds }, 429);

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
      "You are a careful grocery product matcher and basket price ESTIMATOR for the specified country and supermarket.",
      "LIVE RESEARCH: You have Google Search grounding. For each supermarket, actively search the official supermarket website and reliable indexed product pages for the requested product before estimating. Prioritize the supermarket website/domain supplied in the supermarket data. Search using the exact product name, brand, variant and package size. Use live search evidence to identify product names, package sizes and visible prices. Do not claim stock or availability unless the source explicitly confirms it. If no reliable product or price evidence is found, you may provide a clearly labelled market estimate only when responsible; otherwise use no_reliable_match. Never invent URLs, promotions or catalogue references.",
      "",
      "PRODUCT MATCHING AND FALLBACK - follow this order independently for EVERY basket item and EVERY supermarket:",
      "1. EXACT MATCH: same brand, product name/line, variant, relevant attributes and package size.",
      "2. SAME BRAND VARIANT: if the exact product is not found, use the closest credible product from the same brand and product family.",
      "3. SIMILAR PRODUCT: if no credible same-brand option is found, select the closest equivalent from another brand, preserving product category, variant, quality tier and intended use. Prefer comparable package sizes.",
      "4. COMPARABLE-BASED PRICE ESTIMATE: if no specific substitute product can be found, DO NOT immediately return no_reliable_match. Estimate the requested item price using actual products and prices found in the same supermarket (or reliable local market evidence) that are genuinely comparable in category, quality and use. Normalize observed prices by kg, litre or unit, adjust cautiously for pack size and relevant quality/brand differences, and describe the comparable products and calculation basis in estimationBasis. Do not claim that a comparable product is the requested product.",
      "5. NO RESPONSIBLE ESTIMATE: use no_reliable_match only when there is not enough relevant evidence to estimate responsibly. Never invent a product, source, observed price or comparison basis.",
      "Never jump to a competing brand when an exact or credible same-brand match is plausible. Never substitute a different product category. Do not silently treat a different size as the same pack: report its actual package size and normalize the price by kg, litre or unit where possible.",
      "Brand, variety, fat percentage, dietary type, origin, preparation, freshness/frozen status and pack size are meaningful attributes when present in the requested name. Preserve them in matching.",
      "Do not assume the same product or price exists in every supermarket. Match each supermarket separately. Store price positioning may inform a cautious estimate, but must never override product equivalence.",
      "",
      "PRICE ESTIMATION AND TRANSPARENCY:",
      "Prefer current prices found through Google Search on the selected supermarket's official website. Distinguish observed prices from estimates. Never present an estimated price as a verified price and do not assume promotions or loyalty discounts apply.",
      "For exact or similar products with an observed price, use estimationMethod=observed_price. For a similar substitute whose price is observed, use estimationMethod=similar_product_price. For a requested item priced from other actual comparable products, use matchType=comparable_estimate and estimationMethod=comparable_products. Set estimationBasis to a concise explanation naming the comparable product(s), observed reference prices and normalized unit basis. Set matchedProductName to null when no actual substitute product was identified.",
      "Always return an item-level price when the evidence supports a responsible estimate, even when the exact product cannot be found. A comparable-based estimate must have a real evidence basis and lower confidence / wider range when evidence is weaker. If evidence is insufficient, return no_reliable_match with null prices.",
      "Return one result for each supplied supermarket. Include every requested basket item exactly once and preserve requestedName, quantity and unit. For each item return matchedProductName (nullable), brand when identifiable, packageSize, normalizedUnit (kg, L or un), matchType, estimationMethod, estimationBasis, matchConfidence, matchingNotes, estimatedUnitPrice and estimatedSubtotal. estimatedSubtotal is the total for the requested quantity. Use matchType exact_match, same_brand_variant, equivalent_other_brand, comparable_estimate or no_reliable_match. Use estimationMethod observed_price, similar_product_price, comparable_products or insufficient_evidence. Use low, medium or high for confidence fields.",
      "Set supermarket status to estimated when every basket item has a responsible item-level price, including comparable-based estimates. Set status to insufficient_data only if at least one item genuinely has no responsible estimate. Still return all item-level results for transparency.",
      "For status estimated, the sum of item estimatedSubtotal values must approximately equal estimatedTotal. Keep rangeMin <= estimatedTotal <= rangeMax. Use the exact currency supplied.",
      "",
      "Country: " + country.name + " (" + country.code + "). Currency: " + currency + ". Language: " + country.default_language + ".",
      "Basket (user's exact requested products): " + JSON.stringify(basket),
      "Selected supermarkets: " + JSON.stringify(stores.map((store: any) => ({
        name: store.name,
        website: store.website,
        pricePosition: store.price_position
      }))),
      "Return valid JSON only, using this schema: {stores:[{name,status,estimatedTotal,rangeMin,rangeMax,confidence,notes,items:[{requestedName,matchedProductName,brand,packageSize,normalizedUnit,matchType,estimationMethod,estimationBasis,matchConfidence,matchingNotes,quantity,unit,estimatedUnitPrice,estimatedSubtotal,confidence}]}]}. Use null for unavailable numeric prices and matchedProductName when no substitute was identified. Never omit requested items."
    ].join("\n");

    let freeTrialUsed = false;
    if (!hasAnyPremium) {
      const trialUrl = new URL("/rest/v1/premium_comparison_trials", supabaseUrl);
      trialUrl.search = new URLSearchParams({ select: "user_id", user_id: `eq.${authUser.id}`, limit: "1" }).toString();
      const trialCheck = await fetch(trialUrl, { headers: adminHeaders, signal: AbortSignal.timeout(10000) });
      if (!trialCheck.ok) throw new Error("Não foi possível validar a utilização gratuita.");
      const existingTrial = await trialCheck.json();
      if (existingTrial?.length) {
        return json({ error: "Já utilizaste a tua comparação gratuita. Subscreve o Listoria Premium para continuares a comparar o teu cabaz.", code: "premium_required" }, 403);
      }
    }

    // V2 experiment: isolate each supermarket while preserving the same product matching,
    // live Google Search grounding, model, thinking level and output schema as control A.
    // This keeps failures and latency independent per retailer.
    const comparisonStartedAt = Date.now();
    const storePayloads = stores.map((store: any) => ({
      name: store.name,
      website: store.website,
      pricePosition: store.price_position
    }));
    // Keep Google Search/Gemini concurrency bounded to avoid creating a burst of
    // upstream requests when users select many supermarkets.
    let activeRequests = 0;
    const waitingRequests: Array<() => void> = [];
    const withConcurrency = async <T>(task: () => Promise<T>): Promise<T> => {
      if (activeRequests >= 2) await new Promise<void>((resolve) => waitingRequests.push(resolve));
      activeRequests += 1;
      try {
        return await task();
      } finally {
        activeRequests -= 1;
        waitingRequests.shift()?.();
      }
    };
    const storeRuns = await Promise.all(stores.map((store: any, index: number) => withConcurrency(async () => {
      const storePayload = storePayloads[index];
      const storePrompt = prompt.replace(
        "Selected supermarkets: " + JSON.stringify(storePayloads),
        "Selected supermarkets: " + JSON.stringify([storePayload])
      );
      const startedAt = Date.now();
      try {
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + encodeURIComponent(geminiKey),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: storePrompt }] }],
              tools: [{ google_search: {} }],
              generationConfig: {
                responseMimeType: "application/json",
                maxOutputTokens: 16000,
                thinkingConfig: { thinkingLevel: "medium" }
              }
            }),
            signal: AbortSignal.any([req.signal, AbortSignal.timeout(65000)])
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error("Gemini V2 supermarket estimate failed:", {
            supermarket: store.name,
            status: response.status,
            message: payload?.error?.message || "Unknown upstream error"
          });
          return {
            supermarket: store.name,
            durationMs: Date.now() - startedAt,
            errorCode: response.status === 429 ? "rate_limited" : response.status >= 500 ? "upstream_unavailable" : "upstream_rejected",
            parsed: null,
            groundingChunks: []
          };
        }
        const candidate = payload?.candidates?.[0];
        const raw = candidate?.content?.parts?.map((part: any) => part.text || "").join("") || "";
        try {
          const parsedStore = JSON.parse(raw);
          return {
            supermarket: store.name,
            durationMs: Date.now() - startedAt,
            errorCode: null,
            parsed: parsedStore,
            groundingChunks: candidate?.groundingMetadata?.groundingChunks || []
          };
        } catch {
          console.error("Gemini V2 returned invalid JSON:", { supermarket: store.name });
          return {
            supermarket: store.name,
            durationMs: Date.now() - startedAt,
            errorCode: "invalid_json",
            parsed: null,
            groundingChunks: candidate?.groundingMetadata?.groundingChunks || []
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        console.error("Gemini V2 supermarket request error:", { supermarket: store.name, message });
        return {
          supermarket: store.name,
          durationMs: Date.now() - startedAt,
          errorCode: /timed out|timeout|abort/i.test(message) ? "timeout" : "network_error",
          parsed: null,
          groundingChunks: []
        };
      }
    })));

    if (req.signal.aborted) {
      console.info("Basket estimate V2 cancelled by client before trial consumption:", { requestId });
      return json({ error: "A comparação foi cancelada.", code: "request_cancelled" }, 499);
    }

    const successfulRuns = storeRuns.filter((run: any) => run.parsed && Array.isArray(run.parsed?.stores) && run.parsed.stores.length > 0);
    const parsed: any = {
      stores: storeRuns.map((run: any) => {
        const returnedStores = Array.isArray(run.parsed?.stores) ? run.parsed.stores : [];
        const matchingStore = returnedStores.find((entry: any) =>
          String(entry?.name || "").trim().toLocaleLowerCase() === run.supermarket.toLocaleLowerCase()
        );
        return matchingStore || {
          name: run.supermarket,
          status: "insufficient_data",
          notes: run.errorCode
            ? "Não foi possível concluir a pesquisa deste supermercado. Os restantes resultados foram preservados."
            : "A pesquisa não devolveu um resultado válido para este supermercado.",
          items: []
        };
      })
    };
    const candidate = {
      groundingMetadata: {
        groundingChunks: storeRuns.flatMap((run: any) => run.groundingChunks || [])
      }
    };
    const experimentMetrics = {
      variant: "B_parallel_per_supermarket",
      totalDurationMs: Date.now() - comparisonStartedAt,
      supermarkets: storeRuns.map((run: any) => ({
        name: run.supermarket,
        durationMs: run.durationMs,
        outcome: run.errorCode || (run.parsed ? "success" : "empty_response")
      }))
    };
    console.info("Basket estimate V2 metrics:", experimentMetrics);
    if (!successfulRuns.length) {
      const hasRateLimit = storeRuns.some((run: any) => run.errorCode === "rate_limited");
      const hasTimeout = storeRuns.some((run: any) => run.errorCode === "timeout");
      return json({
        error: hasRateLimit
          ? "A pesquisa de preços está temporariamente sobrecarregada. Tenta novamente dentro de alguns instantes."
          : hasTimeout
            ? "A pesquisa de preços demorou mais do que o esperado. Tenta novamente; não perdeste a tua lista."
            : "Não foi possível concluir a pesquisa de preços. Tenta novamente dentro de alguns instantes.",
        code: hasRateLimit ? "gemini_rate_limited" : hasTimeout ? "estimate_timeout" : "gemini_upstream_error",
        experimentMetrics
      }, hasTimeout ? 504 : 502);
    }


    const known = new Map<string, any>(stores.map((store: any) => [String(store.name).toLocaleLowerCase(), store] as [string, any]));
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
        const matchTypes = ["exact_match", "same_brand_variant", "equivalent_other_brand", "comparable_estimate", "no_reliable_match"];
        const estimationMethods = ["observed_price", "similar_product_price", "comparable_products", "insufficient_evidence"];
        const matchType = matchTypes.includes(matched?.matchType) ? matched.matchType : "no_reliable_match";
        const estimationMethod = estimationMethods.includes(matched?.estimationMethod)
          ? matched.estimationMethod
          : (matchType === "comparable_estimate" ? "comparable_products" : "insufficient_evidence");
        const unitPrice = Number(matched?.estimatedUnitPrice);
        const subtotal = Number(matched?.estimatedSubtotal);
        const validPrice = matchType !== "no_reliable_match" &&
          Number.isFinite(unitPrice) && unitPrice > 0 &&
          Number.isFinite(subtotal) && subtotal > 0;
        const estimationBasis = String(matched?.estimationBasis || "").trim().slice(0, 220);
        const hasIdentifiedProduct = String(matched?.matchedProductName || "").trim().length > 0;
        const validMatch = validPrice && (
          matchType === "comparable_estimate"
            ? estimationMethod === "comparable_products" && estimationBasis.length > 0
            : hasIdentifiedProduct
        );
        return {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          matchedProductName: validMatch && hasIdentifiedProduct ? String(matched.matchedProductName).trim().slice(0, 140) : null,
          brand: validMatch && matched.brand ? String(matched.brand).trim().slice(0, 70) : null,
          packageSize: validMatch && matched.packageSize ? String(matched.packageSize).trim().slice(0, 50) : null,
          normalizedUnit: validMatch && ["kg", "L", "un"].includes(matched.normalizedUnit) ? matched.normalizedUnit : null,
          matchType: validMatch ? matchType : "no_reliable_match",
          estimationMethod: validMatch ? estimationMethod : "insufficient_evidence",
          estimationBasis: validMatch && estimationBasis ? estimationBasis : null,
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
      if (!hasCompleteMatches) {
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

    if (!hasPremium) {
      const trialResponse = await fetch(new URL("/rest/v1/rpc/consume_free_comparison_trial", supabaseUrl), {
        method: "POST", headers: adminHeaders,
        body: JSON.stringify({ p_user_id: authUser.id, p_request_id: requestId }),
        signal: AbortSignal.timeout(10000)
      });
      if (!trialResponse.ok) throw new Error("Não foi possível confirmar a utilização gratuita.");
      const trialGranted = await trialResponse.json();
      if (trialGranted !== true) {
        return json({ error: "Já utilizaste a tua comparação gratuita. Subscreve o Listoria Premium para continuares a comparar o teu cabaz.", code: "premium_required" }, 403);
      }
      freeTrialUsed = true;
      // Record the first successful free comparison as the user's conversion cohort entry.
      // Analytics failures must not turn a valid estimate into a failed user request.
      const cohortResponse = await fetch(new URL("/rest/v1/premium_comparison_cohorts?on_conflict=user_id", supabaseUrl), {
        method: "POST",
        headers: { ...adminHeaders, Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({ user_id: authUser.id, first_free_comparison_at: new Date().toISOString(), request_id: requestId }),
        signal: AbortSignal.timeout(8000)
      });
      if (!cohortResponse.ok) console.error("Could not record Smart Comparison conversion cohort:", await cohortResponse.text());
    }

    return json({
      generatedAt: new Date().toISOString(),
      country: { code: country.code, name: country.name },
      currency: country.currency_code,
      currencyLocale: country.currency_locale,
      method: "ai_grounded_estimate",
      model: "gemini-3.8-flash",
      experiment: experimentMetrics,
      groundingSources: (candidate?.groundingMetadata?.groundingChunks || [])
        .map((chunk: any) => chunk?.web)
        .filter((web: any) => web?.uri)
        .map((web: any) => ({ title: String(web.title || web.uri).slice(0, 160), url: web.uri }))
        .filter((source: any, index: number, all: any[]) => all.findIndex((entry: any) => entry.url === source.url) === index)
        .slice(0, 20),
      stores: results,
      freeTrialUsed,
      disclaimer: "Estimativa recolhida por IA. O valor apresentado pode não corresponder exatamente ao preço de catálogo ou incluir todos os descontos e promoções aplicáveis."
    });
  } catch (error: any) {
    if (req.signal.aborted) {
      console.info("Basket estimate V2 request cancelled by client.");
      return json({ error: "A comparação foi cancelada.", code: "request_cancelled" }, 499);
    }
    const message = error instanceof Error ? error.message : String(error || "Unknown error");
    const timedOut = /timed out|timeout|abort/i.test(message);
    console.error("listora-basket-estimate error:", { message, name: error instanceof Error ? error.name : typeof error });
    return json({
      error: timedOut
        ? "A pesquisa de preços demorou mais do que o esperado. Tenta novamente; não perdeste a tua lista."
        : "Ocorreu um erro ao consultar os preços. Tenta novamente dentro de alguns instantes.",
      code: timedOut ? "estimate_timeout" : "estimate_internal_error"
    }, timedOut ? 504 : 500);
  }
});
