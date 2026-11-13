import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const round = (value: number) => Math.round(value * 100) / 100;
const asStoreResults = (parsed: any) => Array.isArray(parsed?.stores)
  ? parsed.stores
  : parsed && typeof parsed === "object" && (Array.isArray(parsed.items) || parsed.name)
    ? [parsed]
    : [];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let stage = "configuration";
  const requestId = crypto.randomUUID();
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
    const rateResponse = await fetch(new URL("/rest/v1/rpc/consume_premium_rate_limit", supabaseUrl), {
      method: "POST", headers: adminHeaders,
      body: JSON.stringify({ p_user_id: authUser.id, p_feature_key: "basket_estimate", p_request_id: requestId, p_limit: 10, p_window_seconds: 60 }),
      signal: AbortSignal.timeout(10000)
    });
    if (!rateResponse.ok) throw new Error("Não foi possível validar o limite de utilização.");
    const rateRows = await rateResponse.json();
    if (rateRows?.[0]?.allowed === false) return json({ error: "Estás a fazer demasiadas pesquisas num curto espaço de tempo. Aguarda um minuto e tenta novamente.", code: "rate_limited", retryAfter: rateRows[0].retry_after_seconds }, 429);

    stage = "input_validation";
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
      "Estimate grocery basket prices for the specified country and supermarkets. Use Google Search grounding and prefer each supermarket's official website.",
      "Keep the task simple: price every requested item, then sum the basket. Do not write long explanations or perform exhaustive searches.",
      "",
      "For EACH item, find a price in this order: exact product; closest same-brand variant; equivalent product from another brand; then a comparable-based estimate.",
      "IMPORTANT FOR GENERIC NAMES: names such as bananas, tomatoes, rice, chicken, milk or yogurt are category requests, not failed product searches. Find a representative standard product sold by this supermarket and price it. If the exact named product is unavailable, use the closest equivalent in the same category.",
      "If no direct substitute is found, search for actual priced products in the same category and use their observed price per kg, litre or unit to calculate a cautious estimate for the requested quantity. This is a comparable_estimate, NOT an exact product match. State the actual comparable products and observed prices in estimationBasis.",
      "Only return no_reliable_match with null prices if you cannot find any relevant priced product or category evidence after a focused search. Never invent an observed price, product, source, promotion or URL. Never present an estimate as an observed price. Preserve important attributes such as brand, variety, dietary type, freshness and pack size; never change product category.",
      "Use exact_match + observed_price for an exact observed product; same_brand_variant or equivalent_other_brand + similar_product_price for an observed substitute; comparable_estimate + comparable_products for a price calculated from observed comparable products. For estimates use lower confidence and a wider range where appropriate.",
      "Return every requested item exactly once per supermarket, preserving requestedName, quantity and unit. Include matchedProductName (null if the price is category-based), packageSize, normalizedUnit (kg, L or un), matchType, estimationMethod, estimationBasis, matchConfidence, matchingNotes, estimatedUnitPrice and estimatedSubtotal. Keep notes short.",
      "Calculate estimatedSubtotal for the requested quantity and estimatedTotal as the sum of all item subtotals. Return rangeMin <= estimatedTotal <= rangeMax. A supermarket is estimated when every item has either an observed exact/similar price or a defensible comparable-based estimate. Do not fail the entire supermarket because the exact requested product was not found.",
      "",
      "Country: " + country.name + " (" + country.code + "). Currency: " + currency + ". Language: " + country.default_language + ".",
      "Basket: " + JSON.stringify(basket),
      "Selected supermarkets: " + JSON.stringify(stores.map((store: any) => ({ name: store.name, website: store.website, pricePosition: store.price_position }))),
      "Return valid JSON only: {stores:[{name,status,estimatedTotal,rangeMin,rangeMax,confidence,notes,items:[{requestedName,matchedProductName,brand,packageSize,normalizedUnit,matchType,estimationMethod,estimationBasis,matchConfidence,matchingNotes,quantity,unit,estimatedUnitPrice,estimatedSubtotal,confidence}]}]}. Never omit requested items. Use null prices only when no relevant evidence exists." 
    ].join("\n");

    // Isolate each retailer so a larger basket does not become one oversized
    // Gemini + Search task. Keep concurrency bounded and preserve successful stores.
    stage = "gemini_request";
    const comparisonStartedAt = Date.now();
    const PRIMARY_TIMEOUT_MS = 42_000;
    const FALLBACK_TIMEOUT_MS = 18_000;
    const GEMINI_TIME_BUDGET_MS = 55_000;
    const geminiDeadlineAt = comparisonStartedAt + GEMINI_TIME_BUDGET_MS;
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + encodeURIComponent(geminiKey);
    const callGemini = async (text: string, useSearch: boolean, timeoutMs: number, outputTokenLimit: number) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
          ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: outputTokenLimit,
            thinkingConfig: { thinkingLevel: "low" }
          }
        }),
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(Math.max(1, timeoutMs))])
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error: any = new Error(payload?.error?.message || "Gemini upstream error");
        error.status = response.status;
        throw error;
      }
      const candidate = payload?.candidates?.[0];
      const raw = candidate?.content?.parts?.map((part: any) => part.text || "").join("") || "";
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Gemini returned invalid JSON");
      }
      return {
        parsed,
        groundingChunks: candidate?.groundingMetadata?.groundingChunks || []
      };
    };

    const normalizeStoreName = (value: unknown) => String(value || "").trim().toLocaleLowerCase();
    const asNamedStores = (value: any) => asStoreResults(value);
    const allStoresPayload = stores.map((store: any) => ({
      name: store.name,
      website: store.website,
      pricePosition: store.price_position
    }));
    const allStoresLine = "Selected supermarkets: " + JSON.stringify(allStoresPayload);

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

    const primaryStartedAt = Date.now();
    const storeRuns = await Promise.all(stores.map((store: any) => withConcurrency(async () => {
      const remainingBudgetMs = geminiDeadlineAt - Date.now();
      if (remainingBudgetMs <= 0 || req.signal.aborted) {
        return {
          supermarket: store.name,
          entry: null,
          durationMs: 0,
          errorCode: req.signal.aborted ? "cancelled" : "deadline_exceeded",
          groundingChunks: []
        };
      }

      const storePayload = [{ name: store.name, website: store.website, pricePosition: store.price_position }];
      const storePrompt = prompt.replace(allStoresLine, "Selected supermarkets: " + JSON.stringify(storePayload));
      const startedAt = Date.now();
      try {
        const response = await callGemini(
          storePrompt,
          true,
          Math.min(PRIMARY_TIMEOUT_MS, remainingBudgetMs),
          Math.min(7000, Math.max(1800, basket.length * 240))
        );
        const returnedStores = asNamedStores(response.parsed);
        const matchingStore = returnedStores.find((entry: any) =>
          normalizeStoreName(entry?.name) === normalizeStoreName(store.name)
        );
        const entry = matchingStore || (returnedStores.length === 1 ? returnedStores[0] : null);
        if (!entry) throw new Error("Gemini did not return a valid result for " + store.name);
        return {
          supermarket: store.name,
          entry: { ...entry, name: store.name },
          durationMs: Date.now() - startedAt,
          errorCode: null,
          groundingChunks: response.groundingChunks
        };
      } catch (error: any) {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        const status = Number(error?.status) || null;
        console.warn("Gemini basket estimate failed for supermarket:", {
          supermarket: store.name,
          status,
          message: message.slice(0, 180)
        });
        return {
          supermarket: store.name,
          entry: null,
          durationMs: Date.now() - startedAt,
          errorCode: status === 429
            ? "rate_limited"
            : /timed out|timeout|abort/i.test(message) ? "timeout" : "upstream_error",
          groundingChunks: []
        };
      }
    })));

    const primaryDurationMs = Date.now() - primaryStartedAt;
    const primaryError = storeRuns.some((run: any) => Boolean(run.errorCode));
    const primaryParsed: any = { stores: storeRuns.filter((run: any) => run.entry).map((run: any) => run.entry) };
    const groundingChunks = storeRuns.flatMap((run: any) => run.groundingChunks || []);
    const primaryByName = new Map<string, any>(
      asNamedStores(primaryParsed).map((entry: any) => [normalizeStoreName(entry?.name), entry] as [string, any])
    );
    const hasUsableItemPrice = (candidate: any) => {
      const matchType = String(candidate?.matchType || "");
      const method = String(candidate?.estimationMethod || "");
      const unitPrice = Number(candidate?.estimatedUnitPrice);
      const subtotal = Number(candidate?.estimatedSubtotal);
      const hasPrice = Number.isFinite(unitPrice) && unitPrice > 0 &&
        Number.isFinite(subtotal) && subtotal > 0;
      if (!hasPrice || matchType === "no_reliable_match") return false;
      if (matchType === "comparable_estimate") {
        return ["comparable_products", "market_estimate"].includes(method) &&
          String(candidate?.estimationBasis || "").trim().length > 0;
      }
      return Boolean(String(candidate?.matchedProductName || "").trim());
    };
    const missingStores = stores.filter((store: any) => {
      const entry = primaryByName.get(normalizeStoreName(store.name));
      return basket.some((item: any) => {
        const candidate = Array.isArray(entry?.items)
          ? entry.items.find((value: any) =>
              String(value?.requestedName || value?.name || "").trim().toLocaleLowerCase() === item.name.toLocaleLowerCase()
            )
          : null;
        return !hasUsableItemPrice(candidate);
      });
    });

    // Fast no-search fallback for retailers omitted by Search or when Search is
    // unavailable. Reuse actual products/prices found for the same basket at
    // other selected retailers; only use broad market estimates when no such
    // evidence exists, and label those estimates explicitly.
    let fallbackUsed = false;
    let fallbackError: string | null = null;
    if (missingStores.length) {
      stage = "gemini_fallback";
      const observedEvidence = asNamedStores(primaryParsed).map((entry: any) => ({
        supermarket: entry?.name,
        items: (Array.isArray(entry?.items) ? entry.items : []).map((item: any) => ({
          requestedName: item?.requestedName || item?.name,
          matchedProductName: item?.matchedProductName || null,
          packageSize: item?.packageSize || null,
          matchType: item?.matchType || null,
          estimationMethod: item?.estimationMethod || null,
          estimationBasis: item?.estimationBasis || null,
          estimatedUnitPrice: item?.estimatedUnitPrice ?? null,
          estimatedSubtotal: item?.estimatedSubtotal ?? null,
          unit: item?.unit || null
        }))
      }));
      const fallbackPrompt = [
        "You are completing a grocery basket estimate. Return one result for EACH missing supermarket and EVERY requested basket item.",
        "This is a fast fallback: do not use web search, tools, or lengthy reasoning.",
        "FIRST reuse the observed product and price evidence supplied from other selected supermarkets for the same requested items. Use those real observed prices as comparable evidence, with a cautious retailer adjustment only when the retailer price position supports it: budget slightly lower, mid/mixed similar, premium slightly higher. Do not claim these are prices observed at the missing supermarket.",
        "Your priority is to return the best useful basket estimate, not to reject the basket for weak evidence. Complete every missing or weakly priced item for each listed supermarket.",
        "For any recognisable grocery item without a found exact or equivalent product, make a best-effort indicative estimate using typical retail prices for this country and category from your general knowledge. Choose a representative standard product and realistic pack size, calculate the requested quantity, and use a deliberately wide range and LOW confidence. Mark estimationMethod as market_estimate and explain the assumptions in estimationBasis. This is not a catalogue price.",
        "For generic category names, always estimate a representative standard product in that category rather than returning no match. Preserve product category and important attributes. If the requested quantity/unit is ambiguous, state the assumption and use a standard unit or pack.",
        "Reuse observed prices from other selected supermarkets when available, but identify the source supermarket and observed price and apply only a cautious adjustment supported by the retailer price position. Never claim a reused price was observed at the target supermarket.",
        "Never invent a live observed price, source, URL, promotion, brand or exact match. Never present a market estimate as a verified price. Use null only for genuinely uninterpretable or non-grocery items where no reasonable category estimate can be made.",
        "For reused observed evidence, mark matchType comparable_estimate and estimationMethod comparable_products. Include the actual comparable product, supermarket and observed price in estimationBasis. Keep confidence low.",
        "Return JSON only using: {stores:[{name,status,estimatedTotal,rangeMin,rangeMax,confidence,notes,items:[{requestedName,matchedProductName,brand,packageSize,normalizedUnit,matchType,estimationMethod,estimationBasis,matchConfidence,matchingNotes,quantity,unit,estimatedUnitPrice,estimatedSubtotal,confidence}]}]}.",
        "Country: " + country.name + " (" + country.code + "), currency " + currency + ", language " + country.default_language + ".",
        "Basket: " + JSON.stringify(basket),
        "Missing supermarkets: " + JSON.stringify(missingStores.map((store: any) => ({ name: store.name, pricePosition: store.price_position }))),
        "Observed evidence from completed retailer searches: " + JSON.stringify(observedEvidence)
      ].join("\n");
      try {
        const fallback = await callGemini(
          fallbackPrompt,
          false,
          FALLBACK_TIMEOUT_MS,
          Math.min(10000, Math.max(2200, basket.length * missingStores.length * 180))
        );
        for (const entry of asNamedStores(fallback.parsed)) {
          const name = normalizeStoreName(entry?.name);
          if (!missingStores.some((store: any) => normalizeStoreName(store.name) === name)) continue;

          const primaryEntry = primaryByName.get(name);
          const primaryItems = Array.isArray(primaryEntry?.items) ? primaryEntry.items : [];
          const fallbackItems = Array.isArray(entry?.items) ? entry.items : [];
          const mergedItems = basket.map((item: any) => {
            const requested = item.name.toLocaleLowerCase();
            const original = primaryItems.find((value: any) =>
              String(value?.requestedName || value?.name || "").trim().toLocaleLowerCase() === requested
            );
            const bestEffort = fallbackItems.find((value: any) =>
              String(value?.requestedName || value?.name || "").trim().toLocaleLowerCase() === requested
            );
            return hasUsableItemPrice(original) ? original : (bestEffort || original || null);
          }).filter(Boolean);

          primaryByName.set(name, {
            ...entry,
            ...(primaryEntry || {}),
            ...entry,
            items: mergedItems,
            notes: entry?.notes || primaryEntry?.notes || ""
          });
        }
        fallbackUsed = true;
      } catch (error) {
        fallbackError = error instanceof Error ? error.message : String(error);
        console.warn("Basket estimate fallback unavailable:", fallbackError);
      }
    }

    const parsed: any = {
      stores: stores.map((store: any) => primaryByName.get(normalizeStoreName(store.name)) || ({
        name: store.name,
        status: "insufficient_data",
        notes: "Não foi possível obter evidência suficiente para estimar este supermercado.",
        items: []
      }))
    };
    const candidate = { groundingMetadata: { groundingChunks } };
    const experimentMetrics = {
      variant: "parallel_per_supermarket_with_fast_fallback",
      primaryDurationMs,
      totalDurationMs: Date.now() - comparisonStartedAt,
      primaryFailed: Boolean(primaryError),
      primaryOutcomes: storeRuns.map((run: any) => ({
        supermarket: run.supermarket,
        durationMs: run.durationMs,
        outcome: run.errorCode || "success"
      })),
      fallbackUsed,
      fallbackFailed: Boolean(fallbackError),
      returnedStores: parsed.stores.filter((entry: any) => entry.status !== "insufficient_data").length,
      selectedStores: stores.length,
      missingStoresAfterGrounding: missingStores.length
    };
    console.info("Basket estimate reliability metrics:", experimentMetrics);
    if (req.signal.aborted) {
      return json({ error: "A comparação foi cancelada.", code: "request_cancelled" }, 499);
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
        const estimationMethods = ["observed_price", "similar_product_price", "comparable_products", "market_estimate", "insufficient_evidence"];
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
            ? ["comparable_products", "market_estimate"].includes(estimationMethod) && estimationBasis.length > 0
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
          matchConfidence: validMatch && estimationMethod !== "market_estimate" && ["low", "medium", "high"].includes(matched.matchConfidence)
            ? matched.matchConfidence : "low",
          matchingNotes: String(matched?.matchingNotes || "").slice(0, 180),
          estimatedUnitPrice: validMatch ? round(unitPrice) : null,
          estimatedSubtotal: validMatch ? round(subtotal) : null,
          confidence: validMatch && estimationMethod !== "market_estimate" && ["low", "medium", "high"].includes(matched.confidence) ? matched.confidence : "low"
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

    if (!results.length || !results.some((store: any) => store.status === "estimated")) {
      return json({ error: "Não foi possível obter preços ou estimativas suficientemente fundamentadas. Tenta novamente dentro de alguns instantes.", code: "no_reliable_estimates", experiment: experimentMetrics }, 502);
    }

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
      method: fallbackUsed ? "ai_grounded_with_fallback" : "ai_grounded_estimate",
      model: "gemini-3.8-flash",
      experiment: experimentMetrics,
      groundingSources: (candidate?.groundingMetadata?.groundingChunks || [])
        .map((chunk: any) => chunk?.web)
        .filter((web: any) => web?.uri)
        .map((web: any) => ({ title: String(web.title || web.uri).slice(0, 160), url: web.uri }))
        .filter((source: any, index: number, all: any[]) => all.findIndex((entry: any) => entry.url === source.url) === index)
        .slice(0, 20),
      stores: results,
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
      code: timedOut ? "estimate_timeout" : "estimate_internal_error",
      stage,
      diagnosticCode: message.slice(0, 120),
      requestId
    }, timedOut ? 504 : 500);
  }
});
