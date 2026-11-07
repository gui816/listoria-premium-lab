# Stripe recurring payments — Listoria Premium

## Commercial plans

Create one Stripe Product named **Listoria Premium** and three recurring EUR Prices:

| Plan key | Amount | Billing interval |
|---|---:|---|
| monthly | €2.99 | every 1 month |
| quarterly | €5.99 | every 3 months |
| half_yearly | €9.99 | every 6 months |

These are recurring subscriptions (not one-off payments). The plan key is stored in Stripe Subscription metadata and in Supabase.

## Stripe secrets

Set these Supabase Edge Function secrets (never put secret keys in the frontend):

- STRIPE_SECRET_KEY — Stripe secret key (test mode first).
- STRIPE_WEBHOOK_SECRET — signing secret for the webhook endpoint.
- STRIPE_PRICE_MONTHLY — recurring Price ID for €2.99/month.
- STRIPE_PRICE_QUARTERLY — recurring Price ID for €5.99/every 3 months.
- STRIPE_PRICE_HALF_YEARLY — recurring Price ID for €9.99/every 6 months.
- APP_URL — full public app URL, including any deployment base path, e.g. https://example.github.io/listoria.

Supabase supplies SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to Edge Functions. Keep service role and Stripe secrets server-side only.

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

1. Apply migrations in order, including 202611040001_user_accounts.sql and 202611070001_premium_subscriptions.sql.
2. Configure Stripe test-mode products/prices and Supabase secrets.
3. Deploy stripe-create-checkout, stripe-create-portal, premium-status and stripe-webhook.
4. Configure the webhook in Stripe.
5. Test checkout with Stripe test cards and confirm the webhook writes subscriptions.
6. Only then switch the Stripe keys and webhook to live mode.

Commands:

```sh
supabase db push
supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... STRIPE_PRICE_MONTHLY=price_... STRIPE_PRICE_QUARTERLY=price_... STRIPE_PRICE_HALF_YEARLY=price_... APP_URL=https://example.github.io/listoria
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-create-portal
supabase functions deploy premium-status
supabase functions deploy stripe-webhook
```

## Entitlement and fair-use rules

- Premium entitlement is checked server-side for every basket estimate request.
- active and trialing subscriptions grant access.
- past_due retains access for 3 days from the first failed payment; repeated webhook events do not extend the grace period.
- canceled retains access only until the already-paid current period ends.
- unpaid, incomplete, incomplete_expired and paused do not grant access.
- Premium is unlimited in normal use; abuse protection allows at most 10 expensive AI estimate requests per user per rolling minute. This is a burst/rate guard, not a monthly allowance.
- All webhook events are stored with their Stripe event ID for idempotency and audit.

## Important

The app currently supports anonymous sessions. Anonymous users can use the free Listora but must upgrade to a permanent account before subscribing. Supabase account linking preserves the user UUID. This ensures the subscription is attached to the account, not a device.
