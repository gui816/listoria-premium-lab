const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "";
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || "";
const CONSENT_KEY = "listora-analytics-consent";
const ATTRIBUTION_KEY = "listora-campaign-attribution";
let initialized = false;
let pageViewKey = "";

export const hasAnalyticsProviders = Boolean(GA_ID || META_PIXEL_ID);

export function getAnalyticsConsent() {
  try { return localStorage.getItem(CONSENT_KEY) || "unknown"; }
  catch { return "unknown"; }
}

export function setAnalyticsConsent(consent) {
  try { localStorage.setItem(CONSENT_KEY, consent); } catch {}
  if (consent === "denied") { try { sessionStorage.removeItem(ATTRIBUTION_KEY); } catch {} }
  if (consent === "granted") {
    captureCampaignAttribution();
    initialiseAnalytics();
    trackPageView();
  }
}

function captureCampaignAttribution() {
  const params = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const values = Object.fromEntries(keys.map((key) => [key, params.get(key)]).filter(([, value]) => value));
  if (!Object.keys(values).length) return;
  try {
    const existing = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || "{}");
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ ...existing, ...values, landing_path: window.location.pathname + window.location.hash, captured_at: new Date().toISOString() }));
  } catch {}
}

export function getCampaignAttribution() {
  try { return JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || "{}"); }
  catch { return {}; }
}

function initialiseAnalytics() {
  if (initialized || getAnalyticsConsent() !== "granted") return;
  initialized = true;

  if (GA_ID && !window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { send_page_view: false, anonymize_ip: true });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(script);
  }

  if (META_PIXEL_ID && !window.fbq) {
    const fbq = function(){ fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    fbq.queue = [];
    fbq.version = "2.0";
    fbq.loaded = true;
    window.fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
    window.fbq("init", META_PIXEL_ID);
  }
}

export function trackPageView() {
  if (getAnalyticsConsent() !== "granted" || !hasAnalyticsProviders) return;
  initialiseAnalytics();
  const path = window.location.pathname + window.location.search + window.location.hash;
  if (path === pageViewKey) return;
  pageViewKey = path;
  const attribution = getCampaignAttribution();
  const safeUrl = new URL(window.location.href);
  for (const key of [...safeUrl.searchParams.keys()]) if (!key.startsWith("utm_") && key !== "pagina") safeUrl.searchParams.delete(key);
  if (window.gtag) window.gtag("event", "page_view", { page_location: safeUrl.toString(), page_title: document.title, ...attribution });
  if (window.fbq) window.fbq("track", "PageView");
  const campaign = String(attribution.utm_campaign || "").toLowerCase();
  const currentParams = new URLSearchParams(window.location.search);
  const hasCurrentCampaign = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].some((key) => currentParams.has(key));
  if (window.gtag && hasCurrentCampaign) window.gtag("event", "campaign_landing", {
    campaign_destination: window.location.hash.includes("comparar") ? "smart_comparison" : (window.location.hash.includes("descobrir") || window.location.hash.includes("funcionalidades") || new URLSearchParams(window.location.search).get("pagina") === "funcionalidades" ? "features" : "home"),
    campaign_name: attribution.utm_campaign || "",
    campaign_source: attribution.utm_source || "",
    campaign_content: attribution.utm_content || ""
  });
  if (window.fbq && (window.location.hash || new URLSearchParams(window.location.search).has("pagina"))) window.fbq("track", "ViewContent");
}

export function trackEvent(eventName, parameters = {}) {
  if (getAnalyticsConsent() !== "granted" || !hasAnalyticsProviders) return;
  initialiseAnalytics();
  const attribution = getCampaignAttribution();
  const payload = { ...parameters, ...attribution };
  if (window.gtag) window.gtag("event", eventName, payload);
  if (window.fbq) {
    const standardEvents = { list_created: "Lead", begin_checkout: "InitiateCheckout" };
    const standardEvent = standardEvents[eventName];
    if (standardEvent) window.fbq("track", standardEvent, payload);
    else window.fbq("trackCustom", eventName, payload);
  }
}

export function trackPremiumEvent(eventName, parameters = {}) {
  if (getAnalyticsConsent() !== "granted" || !hasAnalyticsProviders) return;
  initialiseAnalytics();
  if (window.gtag) window.gtag("event", eventName, { currency: "EUR", ...parameters, ...getCampaignAttribution() });
  if (window.fbq) window.fbq("track", eventName === "purchase" ? "Subscribe" : "InitiateCheckout", parameters);
}
