# Proposed architecture

## Scope

A small modular application and backend for a controlled proof of concept. Keep this architecture country-agnostic but operate initially in Portugal. Avoid microservices until measured scale justifies them.

## Logical components

1. **Client (React/Vite, mobile-first):** receives a basket, requests location permission or accepts a country and postal code/locality, and displays comparison results with coverage and freshness.
2. **Comparison API (Supabase Edge Functions or equivalent):** validates requests, orchestrates matching and pricing, applies freshness/coverage rules, and returns traceable results.
3. **Market/store resolver:** identifies candidate stores and delivery/service areas. Store discovery must not imply price coverage.
4. **Source adapters:** one adapter per approved provider or retailer. Each adapter maps provider-specific records to the internal schema and records source timestamps and errors.
5. **Product matching:** exact GTIN/EAN and retailer identifiers first; deterministic brand/package/unit rules next; optional Gemini-assisted candidate ranking last.
6. **Normalized PostgreSQL data:** stores markets, retailers, stores, products, retailer-specific product identifiers, price observations, and source-run metadata.
7. **Observability:** records ingestion outcomes, coverage, freshness, API failures, cost counters, and matching-quality samples without logging unnecessary personal data.

## High-level flow

1. User submits a basket and a coarse location or grants location permission.
2. Backend resolves market and candidate stores.
3. Backend filters to stores with an approved, usable price source.
4. Source adapters provide current observations or retrieve permitted cached observations.
5. Product matching associates basket items with retailer catalogues.
6. Comparison logic applies package-size, quantity, promotion, currency, and freshness rules.
7. Response returns totals only with explicit coverage, unmatched items, source, modality, and observation time.
8. Client labels partial comparisons and never fills missing values with AI-generated guesses.

## Suggested schema boundaries

### markets
- id
- country_code (ISO 3166-1 alpha-2)
- default_locale
- default_currency (ISO 4217)
- default_unit_system
- timezone
- is_enabled

### retailers
- id
- market_id
- name
- external_retailer_id
- website_url
- status

### stores
- id
- retailer_id
- external_store_id
- name
- latitude, longitude (if available and permitted)
- postal_code, locality, region_code
- price_coverage_status
- last_coverage_check_at

### products
- id
- gtin
- brand
- normalized_name
- package_quantity
- package_unit
- category
- attributes (structured, limited and validated)

### retailer_products
- id
- retailer_id
- store_id (nullable only when catalogue scope is not store-specific)
- external_product_id
- product_id (nullable until verified)
- source_url
- availability_status

### price_observations
- id
- retailer_product_id
- store_id (nullable only when the source is not store-specific)
- price_amount
- currency
- unit_price_amount (nullable if not supplied or safely derivable)
- price_modality (online, in_store, delivery_area)
- promotion_type
- promotion_conditions
- observed_at
- source_updated_at
- source_id
- source_record_id
- raw_payload_hash (avoid storing raw payloads unless permitted and needed)

### source_runs
- id
- source_id
- started_at, finished_at
- status
- records_seen, records_accepted, records_rejected
- error_code
- cost_estimate

### product_matches
- id
- basket_item_fingerprint
- retailer_product_id
- match_method (gtin, retailer_id, rules, ai_suggested, manual_verified)
- confidence
- verification_status
- created_at

These are conceptual fields, not a committed database migration. Confirm data source fields, licence constraints, query patterns, and privacy requirements before finalizing the schema.

## Internationalization

- Store country codes, locale tags, currency codes, and units explicitly.
- Store monetary values as decimal/numeric values or integer minor units with currency; never use floating-point arithmetic for totals.
- Preserve original product names and descriptions alongside normalized fields.
- Keep translations separate from product identity.
- Do not assume a retailer operates the same catalogue, prices, or promotions across countries.
- Make price modality and timezone explicit.
- Treat tax and deposit/return fees as market-specific rules; do not silently mix totals that include and exclude them.
- Keep the first market configuration in data, not scattered conditional code.

## Freshness and confidence policy

- Every observation has provenance and a timestamp.
- Define source-specific freshness windows; the proposed initial target for dynamic online prices is under 48 hours when feasible.
- Stale observations are excluded from current totals or explicitly labelled as historical estimates.
- An absent price is null, not zero.
- An uncertain match is unmatched unless the UI explicitly shows it as a candidate for user confirmation.
- AI may suggest a match, but only a source record supplies a price.

## Security and privacy

- Never expose provider credentials or Gemini API keys in client bundles.
- Use separate development Supabase and provider credentials; never reuse production secrets.
- Do not collect a full street address when locality or postal code is sufficient.
- Avoid storing precise user coordinates with basket history unless required, consented to, and documented.
- Validate all prices, currencies, quantities, source IDs, and external payloads on the server.
- Add rate limits and cost controls before exposing endpoints publicly.
- Keep payment and entitlement work out of the first data-source feasibility gate.

## Future deployment boundary

The lab must use its own repository, project, environment variables, database, and deployment URL. Any eventual integration with Listoria production requires a separate explicit decision after the proof of concept is validated.
