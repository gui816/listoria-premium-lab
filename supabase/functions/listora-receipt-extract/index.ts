// Supabase Edge Function: securely extract structured data from a receipt.
// Configure GEMINI_API_KEY as a Supabase secret before deploying this function.
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
  if (!apiKey) return json({ error: "O serviço de IA ainda não está configurado no Supabase. Define o segredo GEMINI_API_KEY." }, 503);

  try {
    const body = await req.json();
    const mimeType = String(body?.mimeType || "");
    const fileData = String(body?.fileData || "");
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(mimeType)) {
      return json({ error: "Formato não suportado. Usa JPG, PNG, WebP ou PDF." }, 400);
    }
    if (!fileData || fileData.length > 14_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(fileData)) {
      return json({ error: "O ficheiro está vazio ou excede o limite de 10 MB." }, 400);
    }

    const requestedLanguage = String(body?.language || "pt-PT");
    const warningLanguages: Record<string, string> = {
      "pt-PT": "European Portuguese", en: "English", es: "Spanish", fr: "French",
      de: "German", it: "Italian", nl: "Dutch", pl: "Polish", ro: "Romanian", "zh-CN": "Simplified Chinese",
    };
    const warningLanguage = warningLanguages[requestedLanguage] || "European Portuguese";
    const prompt = [
      "You extract structured purchase receipt data from a receipt/invoice image or PDF.",
      "Write all warnings in " + warningLanguage + ". Keep product names and merchant names exactly as printed on the receipt.",
      "Return only fields that are clearly supported by the document. Never guess missing values.",
      "Dates must be the purchase/transaction date in YYYY-MM-DD format, or null.",
      "total is the final amount paid by the customer, not subtotal or change. vatTotal is the total VAT/tax amount if printed, otherwise null.",
      "storeName is the merchant/supermarket name, or null. Items are line items with a concise name and line total if legible; maximum 40 items.",
      "Use numbers for monetary amounts, decimal separator represented as a dot. confidence is low, medium, or high. Put ambiguities in warnings, maximum 3 short warnings.",
      "For an unclear or cropped receipt, return null for uncertain fields and explain in warnings. Do not include personal data unrelated to the purchase.",
    ].join("\n");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: prompt },
          { inlineData: { mimeType, data: fileData } },
        ] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              storeName: { type: "STRING", nullable: true },
              purchasedAt: { type: "STRING", nullable: true },
              total: { type: "NUMBER", nullable: true },
              vatTotal: { type: "NUMBER", nullable: true },
              confidence: { type: "STRING", enum: ["low", "medium", "high"] },
              warnings: { type: "ARRAY", maxItems: 3, items: { type: "STRING" } },
              items: { type: "ARRAY", maxItems: 40, items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  total: { type: "NUMBER", nullable: true },
                },
                required: ["name", "total"],
                propertyOrdering: ["name", "total"],
              } },
            },
            required: ["storeName", "purchasedAt", "total", "vatTotal", "confidence", "warnings", "items"],
            propertyOrdering: ["storeName", "purchasedAt", "total", "vatTotal", "confidence", "warnings", "items"],
          },
          temperature: 0.1,
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Gemini receipt extraction failed:", response.status, payload?.error?.message || "unknown error");
      return json({ error: response.status === 429
        ? "O serviço de IA atingiu o limite de pedidos. Tenta novamente mais tarde."
        : "Não foi possível analisar a fatura. Confirma a configuração do serviço de IA e tenta novamente." }, 502);
    }

    const raw = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
    const parsed = JSON.parse(raw);
    const date = typeof parsed.purchasedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.purchasedAt) ? parsed.purchasedAt : null;
    const money = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
    return json({
      storeName: typeof parsed.storeName === "string" ? parsed.storeName.trim().slice(0, 120) || null : null,
      purchasedAt: date,
      total: money(parsed.total),
      vatTotal: money(parsed.vatTotal),
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((v: unknown) => typeof v === "string").slice(0, 3).map((v: string) => v.slice(0, 200)) : [],
      items: Array.isArray(parsed.items) ? parsed.items.slice(0, 40).filter((v: any) => typeof v?.name === "string" && v.name.trim()).map((v: any) => ({ name: v.name.trim().slice(0, 100), total: money(v.total) })) : [],
    });
  } catch (error) {
    console.error("Receipt extraction request failed:", error);
    return json({ error: "O ficheiro não pôde ser analisado. Tenta usar uma imagem mais nítida ou um PDF legível." }, 400);
  }
});
