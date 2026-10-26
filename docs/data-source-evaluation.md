# Price-source evaluation matrix

Use one row per provider, retailer, API, feed, or dataset. Record evidence rather than assumptions. An accessible URL does not by itself grant permission for automated or commercial reuse.

## Candidate source categories

| Candidate | Intended role | Initial status | Evidence required |
|---|---|---|---|
| Official retailer API/feed or data partnership | Preferred primary source | Unverified | Written terms, permitted use, coverage, sample payload, refresh SLA, costs |
| Licensed commercial data provider | Potential multi-retailer source | Unverified | Contract/licence, retailer and region coverage, freshness, price model, redistribution rights |
| Open/community price dataset (e.g. Open Prices) | Potential complementary observations | Unverified | Licence for commercial use, attribution/share-alike obligations, evidence quality, coverage and freshness |
| Public retailer product pages | Possible fallback only after review | Not approved | Terms, technical access restrictions, rate limits, legal review, stability and regional behaviour |
| Search results / generative AI | Discovery or candidate matching only | Not a price source | Must not be treated as verified price data |

## Evaluation template

Copy this section for each candidate.

### Source: [name]

- Official URL:
- Date checked:
- Provider/contact:
- Source type: official API / partner feed / licensed provider / open dataset / public web page / other
- Countries and regions:
- Retailers and stores:
- Price modality: online / in-store / delivery area / mixed
- Commercial use permitted: yes / no / unclear
- Storage and caching permitted: yes / no / unclear
- Display and derived comparisons permitted: yes / no / unclear
- Attribution requirements:
- Share-alike or downstream licensing obligations:
- Automated access permitted and under what conditions:
- Authentication and rate limits:
- Cost model and currency:
- Product identifiers: GTIN/EAN / retailer SKU / other
- Price fields: price / unit price / promotion / loyalty conditions / currency
- Store or postal-code granularity:
- Update timestamp and expected refresh interval:
- Availability/stock data:
- Sample size and measured coverage:
- Known data-quality issues:
- Data retention and deletion obligations:
- Risks / unresolved questions:
- Decision: pursue / conditional / reject
- Evidence links:

## Scoring rubric

Score each dimension from 0 to 3 and explain the evidence.

- **Rights:** 0 = prohibited/unknown; 1 = unclear; 2 = limited documented permission; 3 = documented permission covering the intended use.
- **Coverage:** 0 = unusable; 1 = narrow; 2 = useful but incomplete; 3 = strong coverage for pilot.
- **Freshness:** 0 = unknown/stale; 1 = irregular; 2 = known but slower than target; 3 = timestamped and meets the target.
- **Product identity:** 0 = names only; 1 = inconsistent identifiers; 2 = partial stable IDs; 3 = stable identifiers and package details.
- **Regional granularity:** 0 = unknown; 1 = national only; 2 = region/postcode; 3 = store/service-area level where required.
- **Economics:** 0 = unsustainable/unknown; 1 = high or opaque cost; 2 = plausible; 3 = cost supports the target business model.

**Rights is a hard gate:** a high total score cannot compensate for unclear or incompatible permissions. Do not integrate a source into the product until rights and access conditions have been reviewed.

## Coverage metrics

Report these separately for every retailer and price modality:

- matched items / test basket items
- verified-price items / test basket items
- fresh-price items / test basket items
- comparable items / test basket items
- Exact-match rate among items marked matched.
- Percentage of observations with timestamps and source provenance.
- Percentage of prices with conditional promotions or loyalty requirements.
- Median and 95th percentile data age, where measurable.

Do not describe a basket as fully comparable if significant items are missing. Do not infer a price from an AI response.
