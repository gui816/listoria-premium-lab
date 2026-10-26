# Decision log

Record decisions with date, context, options, outcome, and consequences.

## D-001 — Isolate the lab from production

- **Status:** accepted
- **Context:** the feature is experimental and must not affect the live Listoria application.
- **Decision:** use a dedicated repository, separate development infrastructure, separate credentials, and a separate deployment target.
- **Consequences:** no production database, secrets, payment configuration, or deployment target may be reused.

## D-002 — Validate data rights before price ingestion

- **Status:** accepted
- **Context:** public availability of a price does not automatically permit automated collection, storage, redistribution, or commercial comparison.
- **Decision:** source rights and access conditions are a hard gate before integrating any source.
- **Consequences:** the first phase produces evidence and a source matrix. Do not implement an unapproved scraper.

## D-003 — AI is not a source of prices

- **Status:** accepted
- **Context:** generative AI can produce plausible but incorrect or stale prices.
- **Decision:** use AI only for language understanding and candidate product matching. Every price shown must originate from a traceable source observation.
- **Consequences:** missing prices remain missing; confidence and source provenance are preserved.

## D-004 — Portugal first, international-ready data model

- **Status:** accepted
- **Context:** the first operational market is Portugal, but the product should be extensible to other countries.
- **Decision:** model market, locale, currency, unit, retailer, store, price modality, and source explicitly from the start.
- **Consequences:** do not implement country assumptions as global constants.

## D-005 — Phase 1 acceptance gate

- **Status:** proposed
- **Context:** implementation is premature until data coverage, quality, rights, and economics are understood.
- **Decision:** target at least two chains with usable pilot data, documented commercial-use rights, source timestamps, and measurable product-match quality before authorizing the comparison proof of concept.
- **Consequences:** if this gate fails, narrow the pilot or investigate a data partnership before building the main experience.
