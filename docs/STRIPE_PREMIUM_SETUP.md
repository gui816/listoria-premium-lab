# Stripe recurring payments — Listoria Premium

## Commercial plans

Create one Stripe Product named **Listoria Premium** and one recurring EUR Price:

| Plan key | Amount | Billing interval |
|---|---:|---|
| monthly | €1.99 | every 1 month |


This is a recurring subscription (not a one-off payment). Only the monthly plan is supported; the webhook rejects any other Stripe interval or legacy plan metadata.

## Demo mode (no Stripe keys required)\n\nWhen `STRIPE_SECRET_KEY` is absent, checkout automatically switches to a server-side demo subscription. No Stripe account, API key, Price ID, webhook or `APP_URL` is needed for the demo flow. A separate `premium_demo_subscriptions` table keeps simulated entitlements isolated from real Stripe subscriptions. The demo grants 30 days of Premium immediately and includes in-app controls to schedule cancellation, reactivate, simulate a failed payment (3-day grace), resolve payment, renew for 30 days or expire the subscription. The basket-estimate endpoint recognises demo entitlements exactly like paid Premium.\n\nApply `202611070002_premium_demo_mode.sql` after the Premium migration and deploy `premium-demo-manage`. The Gemini API key is still required to generate real AI basket estimates; demo mode simulates billing, not Gemini results.\n\n## Stripe secrets

Set these Supabase Edge Function secrets (never put secret keys in the frontend):

- STRIPE_SECRET_KEY — Stripe secret key (test mode first).
- STRIPE_WEBHOOK_SECRET — signing secret for the webhook endpoint.
- STRIPE_PRICE_MONTHLY — recurring Price ID for €1.99/month.
- APP_URL — full public app URL, including any deployment base path, e.g. https://example.github.io/listoria.

Supabase supplies SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to Edge Functions. Keep service role and Stripe secrets server-side only.

## Smart Comparison conversion analytics

Apply `202611070003_premium_conversion_analytics.sql` after the Premium and demo migrations. The instrumentation records:

- **Cohort entry:** the first successful free Smart Comparison per Supabase user ID. Failed estimates and subsequent Premium estimates do not create new cohort entries.
- **Paid conversion:** the first successfully paid real Stripe invoice per user. Demo subscriptions are deliberately excluded.
- **Windows:** whether that first payment happened within 7, 30 or 60 days after the first free comparison.
- **Maturity:** a conversion rate is shown only after the full 7/30/60-day observation window has elapsed for the cohort member. This avoids treating recent users as non-converters.
- **Identity:** the Supabase user ID is the join key, so anonymous-to-permanent account conversion must preserve the same Supabase user ID.

The monthly cohort view is `public.premium_comparison_conversion_monthly`. Query it in the Supabase SQL Editor (or through a privileged analytics connection):

```sql
select
  cohort_month,
  free_comparison_users,
  converted_7d,
  conversion_rate_7d_pct,
  converted_30d,
  conversion_rate_30d_pct,
  converted_60d,
  conversion_rate_60d_pct
from public.premium_comparison_conversion_monthly
order by cohort_month desc;
```

The `converted_7d/30d/60d` columns are raw counts observed so far; the corresponding rates use only mature cohort members. For an exact overall rate across all mature users, calculate weighted totals rather than averaging monthly percentages.

These are **first-paid-conversion** metrics, not trial-start or checkout-start metrics. They do not yet measure renewals, churn, refunds, ad attribution or lifetime value. Add campaign attribution separately before using the dashboard to calculate Instagram CAC/ROAS.

## Webhook

After deploying the functions, create a Stripe webhook endpoint:

https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook

Subscribe to:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_failed
- invoice.paid

Copy the endpoint signing secret into STRIPE_WEBHOOK_SECRET. Webhook signature verification is mandatory; the function is configured with verify_jwt = false because Stripe does not send Supabase JWTs.

## Database and deployment order

1. Apply migrations in order, including 202611040001_user_accounts.sql, 202611070001_premium_subscriptions.sql and 202611070002_premium_demo_mode.sql.
2. Configure Stripe test-mode products/prices and Supabase secrets.
3. Deploy stripe-create-checkout, stripe-create-portal, premium-status, premium-demo-manage and stripe-webhook.
4. Configure the webhook in Stripe.
5. Test checkout with Stripe test cards and confirm the webhook writes subscriptions.
6. Only then switch the Stripe keys and webhook to live mode.

Commands:

```sh
supabase db push
supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_PRICE_MONTHLY=price_... APP_URL=https://example.github.io/listoria
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-create-portal
supabase functions deploy premium-status
supabase functions deploy stripe-webhook
supabase functions deploy listora-basket-estimate
```

## Entitlement and fair-use rules

- Every identity (including a guest session) receives one free basket comparison, enforced server-side and shared across devices when the account identity is retained. A failed AI request does not consume the free comparison; it is only recorded after a successful estimate. Concurrent first-use requests are resolved atomically, so only one receives the free result.
- After the free comparison, an active Premium subscription is required.
- Premium entitlement is checked server-side for every basket estimate request.
- active and trialing subscriptions grant access.
- past_due retains access for 3 days from the first failed payment; repeated webhook events do not extend the grace period.
- canceled retains access only until the already-paid current period ends.
- unpaid, incomplete, incomplete_expired and paused do not grant access.
- Premium is unlimited in normal use; abuse protection allows at most 10 expensive AI estimate requests per user per rolling minute. This is a burst/rate guard, not a monthly allowance.
- All webhook events are stored with their Stripe event ID for idempotency and audit.

## Important

The app supports anonymous sessions. A guest can use the one free comparison; a permanent account is required before subscribing. Account linking should preserve the Supabase user UUID so the free trial and subscription remain attached to the same identity.
