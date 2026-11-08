# Smart Comparison V2 experiment

## Goal

Compare the current `listora-basket-estimate` (A) with the isolated-per-supermarket implementation `listora-basket-estimate-v2` (B), without changing the production client or weakening product/price matching rules.

## What changes in B

- One Gemini + Google Search request per selected supermarket.
- Supermarket requests run concurrently, with a maximum of two simultaneous upstream calls.
- Each request receives the same basket, matching instructions, model, grounding tool, thinking level and JSON schema as A, but only one supermarket.
- A failure for one supermarket does not discard a successful result from another.
- Per-supermarket duration and outcome are returned in `experiment` and written to Edge Function logs.

B intentionally does not add cache yet. This first experiment isolates the effect of splitting and parallelizing the current grounded research. Cache can be evaluated as a second change after we have a clean baseline.

## Deploy

The experimental function is not called by the app. It is deployed only through the manual `workflow_dispatch` path in the Supabase Edge Function workflow, from this branch. JWT verification remains enabled.

## A/B procedure

Use a Premium test account so the one-time free comparison trial does not prevent the second request.

1. Choose a representative basket (ideally 20–30 products) and two supermarkets.
2. Save the exact request JSON and reuse it unchanged for both variants.
3. Call A: `POST /functions/v1/listora-basket-estimate`.
4. Call B: `POST /functions/v1/listora-basket-estimate-v2`.
5. Alternate order across repeated runs (A/B, then B/A) to reduce time-of-day/provider-load bias.
6. Run at least five paired comparisons with the same basket. Avoid running the calls simultaneously because that would make them compete for the same Google/Gemini capacity.
7. Record response time, HTTP status, returned stores, item count, priced-item count, no-match count, confidence, totals, and grounding source count.

## Acceptance criteria

B is a candidate for rollout only if:

- Median total latency improves materially (target: at least 25%).
- The number of products with a credible matched price does not fall by more than 2 percentage points.
- No supermarket result is silently represented as complete after its request fails.
- Basket totals remain internally consistent with item subtotals.
- Error/timeout rate does not increase.
- Any additional Gemini/Search cost is understood before rollout.

A faster result is not a win if it reduces the number of credibly priced products or makes the basket total less trustworthy.

## Important interpretation

B makes two separate upstream calls instead of one combined call. This can improve wall-clock time and isolate failures, but may increase request cost or quota consumption. The experiment metrics and paired tests must confirm whether the trade-off is worthwhile.

The function's `experiment.totalDurationMs` measures the parallel research phase; client-observed end-to-end duration should also be recorded because authentication, subscription checks and persistence checks are outside that interval.
