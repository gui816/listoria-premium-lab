# Supabase Edge Function: Listora receipt extraction

This function calls Gemini server-side so the API key is never bundled into the browser app.

## Deploy and configure

From the repository root, with the Supabase CLI installed and linked to project `wczehxiveifxmdcxxiqw`:

```sh
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
supabase functions deploy listora-receipt-extract
```

The function uses Supabase's default JWT verification. The app invokes it using its Supabase client and publishable/anon key. Do not add `GEMINI_API_KEY` to any `VITE_*` variable or commit the secret.

The function accepts JPG, PNG, WebP and PDF files up to 10 MB, returns suggested merchant/date/total/VAT/items, and never writes a receipt to the database. The user reviews and edits suggestions in the app and must press **Guardar fatura** separately.

## Configure without the CLI

In Supabase Dashboard for the project:
1. Open **Edge Functions → Secrets** and add `GEMINI_API_KEY`.
2. Deploy the `listora-receipt-extract` function from this repository using the Supabase CLI or your normal deployment pipeline.

AI extraction requires a Gemini API key and may incur usage charges or hit provider quotas.
