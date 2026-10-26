# Listoria Premium Lab

Independent research and development workspace for validating a real-price supermarket basket comparison feature for Listoria.

> **Safety boundary:** this repository is separate from the Listoria production repository. Do not reuse production credentials, Supabase projects, payment configuration, or deployment targets.

## Current stage

**Phase 1 — Data-source feasibility and architecture validation.**

The first deliverable is evidence that we can legally and reliably obtain usable supermarket prices for a defined Portuguese pilot area. Do not build the production comparison flow, enable payments, or present AI-generated prices as real before this gate passes.

## Goals

- Identify price-data sources with documented commercial-use rights.
- Validate coverage, freshness, product identifiers, store/region granularity, and cost.
- Design a country-agnostic data model, starting operationally in Portugal.
- Define quality and acceptance gates before implementing the comparison engine.
- Keep all experiments isolated from Listoria production.

## Phase 1 documents

- [Research plan](docs/phase-1-research.md)
- [Source evaluation matrix](docs/data-source-evaluation.md)
- [Proposed architecture](docs/architecture.md)
- [Decision log](docs/decisions.md)

## Non-goals for Phase 1

- No production Listoria changes.
- No payments or Premium entitlement implementation.
- No automated collection from retailer sites until terms, permissions, and technical constraints have been reviewed.
- No real-price claims based on Gemini or other generative AI output.
- No public launch.

## Initial operating principles

1. Every displayed price must have a traceable source and observation timestamp.
2. Unknown or stale prices are missing data, not values to guess.
3. Product matching must preserve brand, package size, quantity, unit, and relevant product variants.
4. Store discovery and price availability are separate capabilities.
5. Each market defines its country, locale, currency, units, and regional rules.
6. Any later implementation must use separate development credentials and infrastructure.

## Status

Phase 1 is in progress. Source availability and commercial-use permissions are **not yet verified**.
