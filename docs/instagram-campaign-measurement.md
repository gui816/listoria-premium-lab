# Instagram campaign measurement

## Campaign-to-page strategy

| Ad angle | Landing destination | UTM content |
| --- | --- | --- |
| Family shopping organisation / shared lists | Main landing page | `family_lists` |
| Voice, photo and AI features | Feature discovery page (`#funcionalidades`) | `ai_voice_photo` |
| Saving money / supermarket basket comparison | Smart comparison section (`#comparar`) | `basket_savings` |

The objective is activation and paid conversion, not traffic volume alone.

## UTM convention

Use the following values consistently:

- `utm_source=instagram`
- `utm_medium=paid_social`
- `utm_campaign=pt_launch_<audience>_<yyyymm>` (example: `pt_launch_families_202611`)
- `utm_content=<creative_or_angle>` (examples: `family_lists`, `ai_voice_photo`, `basket_savings`)
- `utm_term=<audience_or_adset>` (optional)

Examples:

```text
https://listoria.xyz/?utm_source=instagram&utm_medium=paid_social&utm_campaign=pt_launch_families_202611&utm_content=family_lists
https://listoria.xyz/?utm_source=instagram&utm_medium=paid_social&utm_campaign=pt_launch_families_202611&utm_content=ai_voice_photo#funcionalidades
https://listoria.xyz/?utm_source=instagram&utm_medium=paid_social&utm_campaign=pt_launch_families_202611&utm_content=basket_savings#comparar
```

Keep all UTMs on every ad destination. The app recognises `#funcionalidades` and `#comparar` as direct entry points.

## Events measured

Events are sent to GA4 and/or Meta Pixel only after explicit analytics consent.

| Funnel stage | Event |
| --- | --- |
| Campaign landing | `page_view`, `campaign_landing` |
| Explore features | `feature_discovery_opened` |
| Click primary CTA | `create_list_cta_clicked` |
| Create a family list | `list_created` (Meta standard event: `Lead`) |
| Join a shared list | `family_list_joined` |
| Share an invitation | `family_invite_shared` |
| Start basket comparison | `basket_comparison_started` |
| Complete basket comparison | `basket_comparison_completed` |
| Comparison error / Premium gate | `basket_comparison_failed` |
| Start Stripe checkout | `begin_checkout` (Meta: `InitiateCheckout`) |
| Confirmed active Premium subscription | `premium_subscription_active` |

Do not send list names, product names, receipt contents, member names, email addresses, share codes, or other personal data in analytics events.

## Funnel KPIs

1. Landing-page visits by campaign and creative.
2. Landing-to-create-list CTA rate.
3. Visitor-to-list-created activation rate.
4. Invite share rate and invited-member join rate.
5. First basket-comparison start and completion rates.
6. Checkout-start to confirmed Premium activation rate.
7. Cost per activated family and cost per Premium subscriber (once Meta Ads spend is available).

## Configuration

Set these Vite build-time variables in the deployment environment:

- `VITE_GA_MEASUREMENT_ID` — GA4 measurement ID (optional).
- `VITE_META_PIXEL_ID` — Meta Pixel ID (optional).

At least one provider must be configured. If neither is set, no analytics script or consent banner is loaded. Analytics and campaign attribution remain disabled until the visitor explicitly accepts. A visitor can later reopen privacy settings from the shield button and reject analytics; no event payload contains product or family-list content.

## Launch checklist

- Configure GA4 and Meta Pixel IDs in the GitHub Pages / build environment.
- Verify both providers in their real-time / test-event tools after accepting analytics consent.
- Verify that rejecting consent loads neither provider and sends no events.
- Use distinct `utm_campaign` and `utm_content` values for every campaign and creative.
- Configure Meta custom conversions / GA4 key events for list creation, comparison completion and Premium activation.
- Compare performance by activated family and paid subscriber, not only CTR or landing visits.
