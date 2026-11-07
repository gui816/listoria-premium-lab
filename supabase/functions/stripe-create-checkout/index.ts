import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const plans = { monthly: { env: "STRIPE_PRICE_MONTHLY", label: "Listoria Premium mensal" } } as const;

serve(async (req) => {
 if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
 if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
 try {
  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Inicia sessão para subscrever o Premium." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const appUrl = Deno.env.get("APP_URL");
  if (!stripeKey || !appUrl || !url || !anon || !service) return json({ error: "A configuração de pagamentos está incompleta." }, 503);
  const authClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return json({ error: "Sessão inválida. Volta a iniciar sessão." }, 401);
  if (user.is_anonymous) return json({ error: "Cria uma conta Listoria antes de subscrever o Premium." }, 403);
  const body = await req.json().catch(() => ({}));
  const planKey = "monthly" as keyof typeof plans;
  if (!(planKey in plans)) return json({ error: "Seleciona um plano válido." }, 400);
  const priceId = Deno.env.get(plans[planKey].env);
  if (!priceId) return json({ error: `O preço Stripe do plano ${planKey} ainda não está configurado.` }, 503);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: existing } = await admin.from("subscriptions").select("stripe_customer_id,status,current_period_end,past_due_grace_until").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing?.status === "active" || existing?.status === "trialing" || (existing?.status === "past_due" && existing.past_due_grace_until && new Date(existing.past_due_grace_until) > new Date())) {
    return json({ error: "Já tens uma subscrição Premium ativa.", code: "already_subscribed" }, 409);
  }
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });
  const session = await stripe.checkout.sessions.create({
   mode: "subscription",
   line_items: [{ price: priceId, quantity: 1 }],
   customer: existing?.stripe_customer_id || undefined,
   customer_email: existing?.stripe_customer_id ? undefined : (user.email || undefined),
   client_reference_id: user.id,
   metadata: { supabase_user_id: user.id, plan_key: planKey },
   subscription_data: { metadata: { supabase_user_id: user.id, plan_key: planKey } },
   allow_promotion_codes: true,
   billing_address_collection: "auto",
   success_url: `${appUrl.replace(/\/$/, "")}/?premium=success&session_id={CHECKOUT_SESSION_ID}`,
   cancel_url: `${appUrl.replace(/\/$/, "")}/?premium=cancelled`
  });
  await admin.from("subscriptions").upsert({
   user_id: user.id, stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
   stripe_checkout_session_id: session.id, stripe_price_id: priceId, plan_key: planKey, status: "incomplete"
  }, { onConflict: "stripe_checkout_session_id" });
  return json({ url: session.url });
 } catch (error) {
  console.error("stripe-create-checkout:", error);
  return json({ error: "Não foi possível iniciar o checkout. Tenta novamente." }, 500);
 }
});
