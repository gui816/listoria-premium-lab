# Phase 1 — Data-source feasibility

## Objective

Determine whether Listoria Premium Lab can provide useful supermarket basket comparisons using real prices from sources whose access and commercial reuse are permitted. Start with Portugal as the first operational market while keeping the architecture ready for additional countries.

This phase is research and evidence gathering. It is not approval to scrape websites, launch a paid feature, or build the full comparison engine.

## Questions to answer

1. Which sources explicitly permit the intended access, storage, transformation, display, and commercial use?
2. Which Portuguese retailers, stores, products, and price modalities are covered?
3. How often are prices refreshed, and how is freshness evidenced?
4. Can products be matched reliably by GTIN/EAN, retailer SKU, brand, package quantity, and unit?
5. Are prices store-specific, postal-code-specific, delivery-area-specific, or national?
6. What are the recurring and variable costs, including licences and rate limits?
7. What fallback behaviour is acceptable when a source is unavailable or data is stale?
8. What data-protection and retention obligations apply to location and user-provided lists?

## Work packages

### WP1 — Define the pilot
- Select a small Portuguese pilot area and record why it was chosen.
- Identify 3–4 candidate retailer chains to investigate; do not imply that any chain is already covered.
- Build a representative test basket of 30–50 everyday products across categories.
- Include products with clear GTIN/EANs, own-brand items, variable package sizes, and a few ambiguous items.
- Decide whether the pilot compares online prices, in-store prices, or treats them as separate modalities.

**Output:** pilot definition and a versioned test basket.

### WP2 — Source inventory
Investigate in parallel: official retailer APIs/partner feeds/data agreements; licensed third-party price/catalogue providers; open/community datasets subject to licence and evidence-quality review; and public retailer pages only after terms, access restrictions, rate limits, and commercial-use rights have been reviewed.

For every source, save the source URL, date checked, applicable terms/licence, contact or access process, supported markets, sample fields, rate limits, and unresolved legal questions.

**Output:** completed source evaluation matrix with evidence links.

### WP3 — Validate real sample data
Only use a source after the permitted access path is clear.
- Obtain a sample covering the test basket and at least two candidate retailer chains where feasible.
- Capture product identifier, title, brand, package quantity, price, currency, store/region, price modality, promotion conditions, observation/update timestamp, source, and availability.
- Compare a sample with the retailer's own product page or other permitted ground truth.
- Record missing products, stale prices, mismatched sizes, loyalty-only prices, and regional differences.
- Never fill gaps with model-generated prices.

**Output:** coverage and quality report with examples and reproducible validation notes.

### WP4 — Product matching feasibility
- Prefer exact GTIN/EAN matches where available.
- Otherwise compare retailer SKU, brand, normalized name, package quantity, unit, and variant.
- Use Gemini only to propose or rank candidate matches, not to assert facts unsupported by source data.
- Define confidence levels and when to mark a product unmatched.
- Treat different pack sizes and unit prices explicitly; do not silently compare unlike products.

**Output:** matching rules and a labelled sample of correct/incorrect/uncertain matches.

### WP5 — Architecture and cost model
- Confirm country, retailer, store, product, offer, and price-observation boundaries.
- Estimate refresh frequency, storage, source/API costs, compute, and AI usage.
- Model low/base/high usage scenarios.
- Document location minimisation and retention requirements.
- Define a source-adapter interface so a provider can be replaced without rewriting comparison logic.

**Output:** architecture decision and monthly cost scenarios.

### WP6 — Gate review
Review the evidence and choose one outcome: GO; CONDITIONAL GO with explicit blockers; or NO-GO / RE-SCOPE if no viable source or coverage is insufficient.

**Output:** decision log with evidence and follow-up actions.

## Proposed acceptance criteria

These are targets for the pilot, not claims about current source performance.

| Area | Proposed threshold |
|---|---|
| Rights | At least one source with documented permission for intended commercial use, including storage and display |
| Retailer coverage | At least two chains with usable real-price coverage for the pilot; investigate 3–4 chains |
| Test basket | 30–50 representative items, with coverage measured per chain and category |
| Product matching | At least 90% exact/verified matching among products claimed as matched; report coverage separately |
| Freshness | Source timestamp available; target under 48 hours for dynamic online prices where the source supports it |
| Price traceability | Every price observation stores source, timestamp, currency, modality, and relevant store/region |
| Comparability | Package size and unit are explicit; conditional promotions are clearly distinguished |
| Location | Store or service-area coverage can be determined without collecting a full street address |
| Cost | Low/base/high operating cost estimates produced, including data licensing |
| International readiness | Country/locale/currency/unit differences represented in the model rather than hard-coded into product logic |

A 48-hour freshness target is a proposed product goal, not a promise that every provider can meet it. If only older prices are available, classify them honestly or exclude them from current basket totals.

## Deliverables

- Pilot area and test-basket specification.
- Source evaluation matrix with evidence and licence notes.
- Sample data and reproducible validation report, only where permitted.
- Product-matching rules and measured quality.
- Architecture and data model.
- Low/base/high cost model.
- Gate decision: GO, CONDITIONAL GO, or NO-GO / RE-SCOPE.

## Explicit exclusions

No production repository changes, no production credentials, no payment integration, no user-facing real-price claims, and no automated collection before access terms have been reviewed.
