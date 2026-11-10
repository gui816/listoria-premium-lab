import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import PremiumSubscription from "./PremiumSubscription.jsx";
import { trackEvent } from "../lib/analytics.js";
import {
  Sparkles, LoaderCircle, Globe2, ChevronDown, X, MapPin,
  ShoppingBasket, ChevronRight, ArrowLeft, Clock3, CheckCircle2, Search, PackageSearch, Store, Coins, Calculator, Coffee
} from "lucide-react";

const COUNTRY_STORAGE_KEY = "listora-country-code";
const CACHE_TTL = 6 * 60 * 60 * 1000;
const money = (value, locale, currency) =>
  new Intl.NumberFormat(locale || "pt-PT", { style: "currency", currency: currency || "EUR" }).format(value);

const getStoredCountry = () => {
  try { return localStorage.getItem(COUNTRY_STORAGE_KEY)?.toUpperCase() || ""; }
  catch { return ""; }
};
const getStoredSource = () => {
  try { return localStorage.getItem("listora-country-source") || "saved"; }
  catch { return "saved"; }
};
const normaliseItems = (items = []) => items.map((item) => ({
  name: String(item.name || "").trim(),
  quantity: Number(item.quantity) || 1,
  unit: item.unit || "un"
})).filter((item) => item.name).sort((a, b) => a.name.localeCompare(b.name));

const LOADING_MESSAGES = [
  { after: 0, icon: ShoppingBasket, title: "A preparar o teu cabaz", detail: "Estamos a organizar a lista para começar a comparação.", tone: "helpful" },
  { after: 4, icon: Search, title: "A analisar os produtos", detail: "Estamos a procurar as melhores correspondências para cada artigo.", tone: "helpful" },
  { after: 8, icon: PackageSearch, title: "Há produtos difíceis de encontrar…", detail: "Mas nós não desistimos! Estamos à procura deles. Dá-nos só mais um bocadinho.", tone: "fun" },
  { after: 12, icon: Store, title: "A explorar supermercados", detail: "Estamos a reunir preços e informação das lojas selecionadas.", tone: "helpful" },
  { after: 17, icon: Coins, title: "Cada cêntimo conta!", detail: "Estamos a fazer as contas. A carteira agradece este esforço!", tone: "fun" },
  { after: 22, icon: Calculator, title: "A calcular o teu cabaz", detail: "Estamos a validar os valores para te mostrar uma estimativa clara.", tone: "helpful" },
  { after: 28, icon: Clock3, title: "O teu cabaz é exigente…", detail: "Mas nós gostamos de desafios. Estamos a afinar os resultados!", tone: "fun" },
  { after: 38, icon: Sparkles, title: "Estamos mesmo a finalizar!", detail: "Não desistas agora, estamos a dar tudo por tudo. Falta muito pouco!", tone: "reassure" },
  { after: 50, icon: Coffee, title: "Até os algoritmos já pediram café…", detail: "A comparação ainda está a trabalhar. Obrigado por esperares mais um bocadinho!", tone: "reassure" }
];

export default function BasketEstimate({ items, language = "pt-PT", session }) {
  const [countries, setCountries] = useState([]);
  const [countryCode, setCountryCode] = useState(getStoredCountry);
  const [countrySource, setCountrySource] = useState(getStoredCountry() ? getStoredSource() : "unknown");
  const permissionCheckDone = useRef(false);
  const [locationState, setLocationState] = useState("checking");
  const [locationMessage, setLocationMessage] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [supermarkets, setSupermarkets] = useState([]);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingElapsedSeconds, setLoadingElapsedSeconds] = useState(0);
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [stale, setStale] = useState(false);
  const [showPremiumPrompt, setShowPremiumPrompt] = useState(false);
  const [freeComparisonAvailable, setFreeComparisonAvailable] = useState(false);
  const [freeComparisonUsed, setFreeComparisonUsed] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const estimateAbortController = useRef(null);

  useEffect(() => () => {
    estimateAbortController.current?.abort();
    estimateAbortController.current = null;
  }, []);

  const country = useMemo(() => countries.find((entry) => entry.code === countryCode), [countries, countryCode]);

  useEffect(() => {
    if (!busy) { setLoadingElapsedSeconds(0); return; }
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setLoadingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [busy]);

  const loadingMessage = [...LOADING_MESSAGES].reverse().find((message) => loadingElapsedSeconds >= message.after) || LOADING_MESSAGES[0];
  const LoadingIcon = loadingMessage.icon;

  // The estimate endpoint returns one completed response; keep the active search state honest
  // instead of rotating through stages that the backend does not expose as live events.
  const cleanItems = useMemo(() => normaliseItems(items), [items]);
  const itemSignature = useMemo(() => JSON.stringify(cleanItems), [cleanItems]);
  const cacheKey = useMemo(() => {
    if (!countryCode || !selected.length || !cleanItems.length) return "";
    return "listora-basket-estimate-v5:" + countryCode + ":" + [...selected].sort().join("|") + ":" + itemSignature;
  }, [countryCode, selected, itemSignature, cleanItems.length]);

  useEffect(() => {
    let active = true;
    if (!supabase || !session?.access_token) return () => { active = false; };
    supabase.functions.invoke("premium-status", { body: {} }).then(({ data, error: statusError }) => {
      if (active && !statusError) {
        const premiumActive = Boolean(data?.isPremium);
        setFreeComparisonAvailable(!premiumActive && Boolean(data?.freeComparisonAvailable));
        setFreeComparisonUsed(!premiumActive && Boolean(data?.freeComparisonUsed));
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    let active = true;
    const loadCountries = async () => {
      if (!supabase) {
        setError("O catálogo de países não está disponível. Confirma a configuração do Supabase.");
        setLoadingCatalogue(false);
        return;
      }
      const { data, error: queryError } = await supabase.from("countries")
        .select("code,name,flag_emoji,currency_code,currency_locale,default_language")
        .order("display_order", { ascending: true });
      if (!active) return;
      if (queryError) setError("Não foi possível carregar os países suportados.");
      else {
        setCountries(data || []);
        const saved = getStoredCountry();
        if (saved && data?.some((entry) => entry.code === saved)) {
          setCountryCode(saved);
          setCountrySource(getStoredSource());
          setLocationState("manual");
        } else if (!saved) {
          setCountryCode("");
          setLocationState("prompt");
        }
      }
      setLoadingCatalogue(false);
    };
    loadCountries();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!countryCode || !supabase) return;
    let active = true;
    const loadSupermarkets = async () => {
      const { data, error: queryError } = await supabase.from("supermarkets")
        .select("id,name,price_position,website,display_order")
        .eq("country_code", countryCode).order("display_order", { ascending: true });
      if (!active) return;
      if (queryError) {
        setError("Não foi possível carregar os supermercados deste país.");
        setSupermarkets([]);
        setSelected([]);
        return;
      }
      const entries = data || [];
      setSupermarkets(entries);
      let savedNames = null;
      try { savedNames = JSON.parse(localStorage.getItem("listora-supermarkets-" + countryCode) || "null"); } catch {}
      const validSaved = Array.isArray(savedNames)
        ? entries.filter((entry) => savedNames.includes(entry.name)).map((entry) => entry.name)
        : [];
      setSelected(validSaved.length ? validSaved : entries.slice(0, 5).map((entry) => entry.name));
    };
    loadSupermarkets();
    return () => { active = false; };
  }, [countryCode]);

  useEffect(() => {
    if (!cacheKey || result) return;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && cached.data) {
        setResult(cached.data);
        setStale(false);
      }
    } catch {}
  }, [cacheKey, result]);

  useEffect(() => {
    if (!items?.length || !result) return;
    try {
      const saved = localStorage.getItem("listora-basket-last-signature");
      if (saved && saved !== itemSignature) setStale(true);
    } catch {}
  }, [itemSignature, items?.length, result]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => { if (event.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, busy]);

  const identifyCountry = async () => {
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      setLocationMessage("Este dispositivo não disponibiliza localização. Escolhe o país manualmente.");
      setShowCountryPicker(true);
      return;
    }
    setLocationState("locating");
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
        url.search = new URLSearchParams({
          latitude: String(coords.latitude),
          longitude: String(coords.longitude),
          localityLanguage: language.startsWith("pt") ? "pt" : "en"
        }).toString();
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error("Não foi possível identificar o país.");
        const place = await response.json();
        const code = String(place.countryCode || "").toUpperCase();
        if (!countries.some((entry) => entry.code === code)) {
          setLocationState("unsupported");
          setLocationMessage("Ainda não temos supermercados configurados para o país detetado. Podes escolher outro país.");
          setShowCountryPicker(true);
          return;
        }
        setCountryCode(code);
        setCountrySource("location");
        setLocationState("located");
        setShowCountryPicker(false);
        try { localStorage.setItem(COUNTRY_STORAGE_KEY, code); } catch {}
      } catch {
        setLocationState("unavailable");
        setLocationMessage("Não conseguimos identificar o país pela localização. Escolhe-o manualmente.");
        setShowCountryPicker(true);
      }
    }, (geoError) => {
      setLocationState(geoError.code === 1 ? "denied" : "unavailable");
      setLocationMessage(geoError.code === 1
        ? "A localização não está autorizada. Podes ativá-la nas definições ou escolher o país manualmente."
        : "Não foi possível obter a localização. Escolhe o país manualmente.");
      setShowCountryPicker(true);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60 * 60 * 1000 });
  };

  useEffect(() => {
    if (!countries.length || permissionCheckDone.current || countrySource === "manual" || countrySource === "saved") return;
    permissionCheckDone.current = true;
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (permission.state === "granted") identifyCountry();
    }).catch(() => {});
  }, [countries.length, countrySource]);

  const changeCountry = (nextCode) => {
    setCountryCode(nextCode);
    setCountrySource("manual");
    setLocationState("manual");
    setShowCountryPicker(false);
    setResult(null);
    setSelectedStore(null);
    setStale(false);
    setError("");
    try { localStorage.setItem(COUNTRY_STORAGE_KEY, nextCode); } catch {}
  };

  const toggleSupermarket = (name) => {
    setSelected((current) => {
      const next = current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name];
      try { localStorage.setItem("listora-supermarkets-" + countryCode, JSON.stringify(next)); } catch {}
      return next;
    });
    setResult(null);
    setSelectedStore(null);
  };

  const cancelEstimate = () => {
    setShowCancelConfirmation(false);
    const controller = estimateAbortController.current;
    if (controller) {
      controller.abort();
      estimateAbortController.current = null;
      trackEvent("basket_comparison_cancelled", {
        item_count: cleanItems.length,
        supermarket_count: selected.length,
        country_code: countryCode,
        source: "smart_comparison"
      });
    }
    setBusy(false);
    setError("");
    setOpen(false);
  };

  const estimate = async (force = false) => {
    if (!cleanItems.length || busy || !countryCode || !selected.length) return;
    if (!force && cacheKey) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && cached.data) {
          setResult(cached.data);
          setStale(false);
          try { localStorage.setItem("listora-basket-last-signature", itemSignature); } catch {}
          return;
        }
      } catch {}
    }
    setShowCancelConfirmation(false);
    const controller = new AbortController();
    estimateAbortController.current = controller;
    setBusy(true);
    trackEvent("basket_comparison_started", { item_count: cleanItems.length, supermarket_count: selected.length, country_code: countryCode, source: "smart_comparison" });
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("listora-basket-estimate-v2", {
        body: { items: cleanItems, countryCode, supermarkets: selected },
        signal: controller.signal
      });
      if (invokeError) {
        const status = invokeError.context?.status;
        if (status === 403) {
          setShowPremiumPrompt(true);
          setFreeComparisonAvailable(false);
          setFreeComparisonUsed(true);
        }
        let detail = null;
        try { detail = await invokeError.context?.clone?.().json(); } catch {}
        const message = detail?.error || invokeError.message || "Não foi possível concluir a estimativa.";
        const diagnostic = detail?.stage
          ? " (fase: " + detail.stage
            + (detail.diagnosticCode ? " · " + String(detail.diagnosticCode).slice(0, 40) : "")
            + (detail.requestId ? " · ref. " + String(detail.requestId).slice(0, 8) : "") + ")"
          : "";
        const code = detail?.code;
        if (status === 429 || code === "rate_limited") {
          throw new Error(detail?.retryAfter
            ? `A comparação está temporariamente limitada. Tenta novamente dentro de ${detail.retryAfter} segundos.`
            : message);
        }
        if (status >= 500) {
          throw new Error(message + diagnostic);
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      setResult(data);
      trackEvent("basket_comparison_completed", { item_count: cleanItems.length, supermarket_count: selected.length, country_code: countryCode, used_free_trial: Boolean(data?.freeTrialUsed) });
      setFreeComparisonAvailable(false);
      if (data?.freeTrialUsed) setFreeComparisonUsed(true);
      setShowPremiumPrompt(Boolean(data?.freeTrialUsed));
      setSelectedStore(null);
      setStale(false);
      try {
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
        localStorage.setItem("listora-basket-last-signature", itemSignature);
      } catch {}
    } catch (estimateError) {
      if (controller.signal.aborted) return;
      trackEvent("basket_comparison_failed", { country_code: countryCode, error_type: estimateError?.context?.status === 403 ? "premium_required" : "request_failed" });
      if (estimateError?.context?.status === 403 || /premium_required/.test(estimateError?.message || "")) setShowPremiumPrompt(true);
      setError(estimateError.message || "Não foi possível estimar o cabaz.");
      if (estimateError?.context?.status === 403) {
        setFreeComparisonAvailable(false);
        setFreeComparisonUsed(true);
      }
    } finally {
      if (estimateAbortController.current === controller) {
        estimateAbortController.current = null;
        setBusy(false);
      }
    }
  };

  const openModal = () => {
    setOpen(true);
    setError("");
    if (result && !stale) return;
    if (cacheKey) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && cached.data) {
          setResult(cached.data);
          setStale(false);
          return;
        }
      } catch {}
    }
  };

  const formatMoney = (value) => money(value, country?.currency_locale || language, result?.currency || country?.currency_code || "EUR");
  const stores = result?.stores || [];
  const bestStore = stores.filter((store) => store.status === "estimated")
    .sort((a, b) => a.estimatedTotal - b.estimatedTotal)[0];
  const updatedAt = result?.generatedAt ? new Date(result.generatedAt) : null;

  return <>

        <style>{`
          .basket-estimate-quality-hint{font-size:14px;line-height:1.45;margin-top:10px!important;padding:12px 14px!important}
          .basket-estimate-modal.is-processing{width:min(100%,560px)}
          .basket-estimate-modal.is-processing .basket-estimate-modal-header{padding-bottom:14px}
          .basket-estimate-modal.is-processing .basket-estimate-modal-header h2{font-size:22px;line-height:1.2}
          .basket-estimate-modal.is-processing .basket-estimate-modal-content{padding-top:14px}
          .basket-estimate-modal.is-processing .basket-estimate-loading{margin:0;padding:clamp(22px,5vw,34px);border-radius:22px;min-height:300px;display:flex;flex-direction:column;justify-content:center;gap:22px;background:radial-gradient(circle at 50% 5%,#e8f2e8 0,transparent 48%),linear-gradient(145deg,#f3f8f1,#fffefa 72%);}
          .basket-estimate-focus-visual{width:76px;height:76px;margin:0 auto;display:grid;place-items:center;border-radius:26px;background:#e1efe4;color:#276b50;box-shadow:0 0 0 10px #eaf3e9;animation:basket-glow 2.2s ease-in-out infinite}
          .basket-estimate-focus-visual svg{transition:transform .35s ease}
          .basket-estimate-focus-visual.tone-fun{background:#f2efdf;color:#8a7130;box-shadow:0 0 0 10px #f8f5e9}
          .basket-estimate-focus-visual.tone-reassure{background:#e8e9f4;color:#5d6392;box-shadow:0 0 0 10px #f0f0f8}
          .basket-estimate-focus-copy strong,.basket-estimate-focus-copy small{animation:basket-message-in .28s ease both}
          @keyframes basket-message-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}

          .basket-estimate-focus-copy{text-align:center;max-width:360px;margin:0 auto}
          .basket-estimate-focus-copy strong{display:block;font-size:21px;line-height:1.25;letter-spacing:-.5px}
          .basket-estimate-focus-copy small{display:block;margin-top:8px;color:#718078;font-size:13px;line-height:1.5}
          .basket-estimate-focus-stores{display:flex;justify-content:center;flex-wrap:wrap;gap:7px}
          .basket-estimate-focus-stores span{padding:6px 10px;border:1px solid #dce8dd;border-radius:99px;background:#ffffffb8;color:#52685a;font-size:11px;font-weight:600}
          .basket-estimate-focus-note{display:flex;align-items:center;justify-content:center;gap:7px;color:#849087;font-size:11px}
          .basket-estimate-focus-note svg{color:#287354}
          .basket-estimate-modal.is-processing .basket-estimate-location-row,.basket-estimate-modal.is-processing .basket-estimate-country-picker,.basket-estimate-modal.is-processing .basket-estimate-location-message,.basket-estimate-modal.is-processing .basket-estimate-location-prompt,.basket-estimate-modal.is-processing .basket-estimate-supermarkets{display:none!important}
          .basket-estimate-modal.is-processing .basket-estimate-modal-header .basket-estimate-quality-hint{display:none}
          @media(max-width:600px){.basket-estimate-modal.is-processing{width:100%;max-height:min(78vh,760px)}.basket-estimate-modal.is-processing .basket-estimate-loading{min-height:clamp(320px,48vh,440px)}.basket-estimate-modal.is-processing .basket-estimate-modal-header h2{font-size:21px}}
          @media(prefers-reduced-motion:reduce){.basket-estimate-focus-visual{animation:none}}
          .basket-estimate-loading{margin-top:18px;padding:16px;border:1px solid #dce9df;border-radius:18px;background:linear-gradient(135deg,#f4f8f2,#fff);color:#1c3329}
          .basket-estimate-loading-top{display:flex;align-items:center;gap:12px}
          .basket-estimate-loading-icon{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border-radius:14px;background:#e2f0e5;color:#276b50;animation:basket-glow 2s ease-in-out infinite}
          .basket-estimate-loading-top strong{display:block;font-size:15px}
          .basket-estimate-loading-top small{display:block;margin-top:3px;color:#718078;font-size:12px;line-height:1.4}
          .basket-estimate-loading-dots{display:flex;gap:4px;margin-left:auto;align-self:center}
          .basket-estimate-loading-dots i{width:5px;height:5px;border-radius:50%;background:#287354;animation:basket-dot 1s ease-in-out infinite}
          .basket-estimate-loading-dots i:nth-child(2){animation-delay:.15s}.basket-estimate-loading-dots i:nth-child(3){animation-delay:.3s}
          .basket-estimate-loading-track{height:5px;margin-top:16px;overflow:hidden;border-radius:10px;background:#e3ebe3}
          .basket-estimate-loading-track span{display:block;width:38%;height:100%;border-radius:10px;background:#287354;animation:basket-travel 1.8s ease-in-out infinite}
          .basket-estimate-loading-steps{display:flex;justify-content:space-between;gap:8px;margin-top:12px}
          .basket-estimate-loading-steps span{display:flex;align-items:center;gap:5px;color:#929c95;font-size:11px}
          .basket-estimate-loading-steps i{width:7px;height:7px;border-radius:50%;background:#d5ddd6}
          .basket-estimate-loading-steps .active{color:#276b50;font-weight:700}.basket-estimate-loading-steps .active i,.basket-estimate-loading-steps .passed i{background:#287354}
          @keyframes basket-travel{0%{transform:translateX(-110%)}50%{transform:translateX(165%)}100%{transform:translateX(290%)}}
          @keyframes basket-dot{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}
          @keyframes basket-glow{0%,100%{transform:scale(1);box-shadow:0 0 0 0 #28735400}50%{transform:scale(1.04);box-shadow:0 0 0 6px #28735412}}
          @media(prefers-reduced-motion:reduce){.basket-estimate-loading *{animation:none!important}}
        `}</style>
    {freeComparisonUsed && session?.user ? <PremiumSubscription session={session} language={language} compact /> : <section className="basket-estimate">
      <div className="basket-estimate-summary">
        <span className="basket-estimate-icon"><Sparkles size={22}/></span>
        <div className="basket-estimate-summary-copy">
          
          <strong>Compara o teu cabaz com IA</strong>
          {bestStore && !stale ? <>
            <b>{formatMoney(bestStore.estimatedTotal)} <small>· {bestStore.name}</small></b>
            <span>Smart comparison · estimativas por supermercado</span>{freeComparisonAvailable && <small className="basket-estimate-free-trial-note">1.ª comparação gratuita</small>}
          </> : <span>Smart comparison · estimativas por supermercado</span>}
        </div>
        <button type="button" className="basket-estimate-open" onClick={openModal}>
          <Sparkles size={16}/><span>{bestStore && !stale ? "Ver comparação" : "Estimar cabaz"}</span><ChevronRight size={17}/>
        </button>
      </div>
      {stale && <p className="basket-estimate-stale-note">A lista foi alterada. Atualiza a estimativa para refletir os produtos atuais.</p>}
    </section>}

    {open && <div className="basket-estimate-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className={"basket-estimate-modal" + (busy ? " is-processing" : "")} role="dialog" aria-modal="true" aria-labelledby="basket-estimate-title">
        <header className="basket-estimate-modal-header">
          <div><span className="basket-estimate-modal-kicker"><Sparkles size={14}/> {busy ? "A COMPARAR O TEU CABAZ" : "COMPARAÇÃO INTELIGENTE"}</span><h2 id="basket-estimate-title">{busy ? "Estamos a analisar o teu cabaz" : "Quanto poderá custar o teu cabaz?"}</h2><p>{cleanItems.length} produtos na lista{busy ? " · " + selected.length + (selected.length === 1 ? " supermercado" : " supermercados") : ""}</p><p className="basket-estimate-quality-hint">A IA procura produtos e preços, apresenta alternativas semelhantes e, quando necessário, estima com base em produtos comparáveis. Os valores não são preços garantidos.</p></div>
          <button type="button" className="basket-estimate-modal-close" onClick={busy ? () => setShowCancelConfirmation(true) : () => setOpen(false)} aria-label={busy ? "Pedir para cancelar estimativa" : "Fechar comparação"}><X size={20}/></button>
        </header>

        {busy && showCancelConfirmation && <div className="basket-estimate-cancel-confirm-backdrop">
          <section className="basket-estimate-cancel-confirm" role="alertdialog" aria-modal="true" aria-labelledby="basket-estimate-cancel-title" aria-describedby="basket-estimate-cancel-description">
            <div className="basket-estimate-cancel-confirm-icon"><X size={22}/></div>
            <h3 id="basket-estimate-cancel-title">Interromper a comparação?</h3>
            <p id="basket-estimate-cancel-description">A pesquisa de preços ainda está em curso. Se interromperes agora, os resultados desta comparação não serão apresentados.</p>
            <div className="basket-estimate-cancel-confirm-actions">
              <button type="button" className="basket-estimate-cancel-keep" onClick={() => setShowCancelConfirmation(false)}>Continuar a analisar</button>
              <button type="button" className="basket-estimate-cancel-accept" onClick={cancelEstimate}>Sim, interromper</button>
            </div>
          </section>
        </div>}

        <div className="basket-estimate-modal-content">
          <div className="basket-estimate-location-row">
            <div className="basket-estimate-location-label"><MapPin size={16}/><span>{country ? country.flag_emoji + " " + country.name : "País por definir"}</span>
              {countrySource === "location" && <small><CheckCircle2 size={12}/> Detetado pela localização</small>}
            </div>
            <button type="button" className="basket-estimate-text-button" onClick={() => setShowCountryPicker((value) => !value)}>
              {showCountryPicker ? "Cancelar" : "Alterar país"}
            </button>
          </div>

          {!countryCode && <div className="basket-estimate-location-prompt">
            <MapPin size={24}/><strong>Em que país estás a fazer compras?</strong>
            <p>Podemos identificar o país através da localização do dispositivo.</p>
            <button type="button" className="basket-estimate-button" onClick={identifyCountry} disabled={locationState === "locating" || loadingCatalogue}>
              {locationState === "locating" ? <><LoaderCircle className="spin" size={17}/> A identificar…</> : <><MapPin size={17}/> Usar a minha localização</>}
            </button>
            <button type="button" className="basket-estimate-text-button" onClick={() => setShowCountryPicker(true)}>Escolher país manualmente</button>
          </div>}

          {showCountryPicker && <div className="basket-estimate-country-picker">
            <label htmlFor="basket-estimate-country">Seleciona o país</label>
            <div><select id="basket-estimate-country" value={countryCode} onChange={(event) => changeCountry(event.target.value)} disabled={loadingCatalogue || busy}>
              <option value="">Selecionar…</option>
              {countries.map((entry) => <option key={entry.code} value={entry.code}>{entry.flag_emoji} {entry.name}</option>)}
            </select><ChevronDown size={16}/></div>
          </div>}
          {locationMessage && <p className="basket-estimate-location-message">{locationMessage}</p>}

          {countryCode && <>
            <div className="basket-estimate-supermarkets">
              <div className="basket-estimate-section-heading"><strong>Supermercados</strong><span>{selected.length} selecionados</span></div>
              <div className="basket-estimate-supermarkets-list">
                {supermarkets.map((store) => <label key={store.id} className={selected.includes(store.name) ? "selected" : ""}>
                  <input type="checkbox" checked={selected.includes(store.name)} onChange={() => toggleSupermarket(store.name)} disabled={busy}/>
                  <span>{store.name}</span>
                </label>)}
              </div>
            </div>

            {!result && (busy ? <div className="basket-estimate-loading" role="status" aria-live="polite">
              <span className={"basket-estimate-focus-visual tone-" + loadingMessage.tone}><LoadingIcon size={36}/></span>
              <div className="basket-estimate-focus-copy" aria-live="polite" aria-atomic="true"><strong key={loadingMessage.title}>{loadingMessage.title}</strong><small key={loadingMessage.detail}>{loadingMessage.detail}</small></div>
              <div className="basket-estimate-loading-track" aria-hidden="true"><span/></div>
              <div className="basket-estimate-focus-stores" aria-label="Supermercados selecionados">{selected.map((name) => <span key={name}>{name}</span>)}</div>
              <div className="basket-estimate-focus-note"><LoaderCircle className="spin" size={15}/> {loadingElapsedSeconds >= 38 ? "Obrigado pela paciência!" : "A pesquisa pode demorar alguns instantes"}</div>
            </div> : <button type="button" className="basket-estimate-button" onClick={() => estimate(false)} disabled={loadingCatalogue || !cleanItems.length || !selected.length}>
              <Sparkles size={17}/> Estimar preço do cabaz
            </button>)}

            {error && <p className="basket-estimate-error" role="alert">{error}</p>}
            {showPremiumPrompt && !result && <div className="basket-estimate-premium-prompt"><strong>A tua comparação gratuita já foi utilizada</strong><p>Subscreve o Listoria Premium para continuares a comparar preços e encontrar onde o teu cabaz fica mais em conta.</p><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("listoria:open-premium"))}>Conhecer o Premium · 1,99 €/mês</button></div>}

            {result && <>
              <div className="basket-estimate-results-heading"><strong>Comparação do cabaz</strong><span>{updatedAt ? <><Clock3 size={12}/> {updatedAt.toLocaleString(language, { dateStyle: "short", timeStyle: "short" })}</> : null}</span></div>
              {result.groundingSources?.length > 0 && <div className="basket-estimate-sources"><strong>Fontes consultadas</strong><div>{result.groundingSources.map((source, index) => <a key={source.url + index} href={source.url} target="_blank" rel="noreferrer">{source.title || new URL(source.url).hostname}</a>)}</div></div>}
              {stale && <div className="basket-estimate-stale-banner">A lista mudou desde a última estimativa. Atualiza para comparar os produtos atuais.</div>}
              <div className="basket-estimate-store-list">
                {stores.map((store) => <button type="button" className={"basket-estimate-store-card" + (selectedStore?.name === store.name ? " active" : "")} key={store.name} onClick={() => setSelectedStore(store)}>
                  <span className="basket-estimate-store-main"><strong>{store.name}</strong>{store.name === bestStore?.name && <small>Melhor estimativa</small>}</span>
                  {store.status === "estimated" ? <span className="basket-estimate-store-total"><b>{formatMoney(store.estimatedTotal)}</b><small>{formatMoney(store.estimatedRange.min)} – {formatMoney(store.estimatedRange.max)}</small></span> : <small>Dados insuficientes</small>}
                  <ChevronRight size={17}/>
                </button>)}
              </div>

              {selectedStore && <div className="basket-estimate-product-detail">
                <div className="basket-estimate-product-heading"><button type="button" onClick={() => setSelectedStore(null)}><ArrowLeft size={15}/> Comparação</button><strong>{selectedStore.name} · detalhe do cabaz</strong></div>
                {selectedStore.notes && <p className="basket-estimate-product-empty">{selectedStore.notes}</p>}
                {selectedStore.items?.length ? selectedStore.items.map((product, index) => {
                  const matchLabels = {
                    exact_match: "Correspondência exata",
                    same_brand_variant: "Mesma marca · variante/formato próximo",
                    equivalent_other_brand: "Alternativa equivalente · outra marca",
                    comparable_estimate: "Preço estimado por produtos comparáveis",
                    no_reliable_match: "Sem correspondência fiável"
                  };
                  return <div className="basket-estimate-product-row" key={product.name + index}>
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.quantity} × {product.unit} · {matchLabels[product.matchType] || "Correspondência por validar"}</small>
                      {product.matchedProductName && <small className="basket-estimate-matched-product">Produto considerado: {product.matchedProductName}{product.packageSize ? " · " + product.packageSize : ""}</small>}
                      {product.estimationBasis && <small>Base da estimativa: {product.estimationBasis}</small>}
                      {product.matchingNotes && <small>{product.matchingNotes}</small>}
                      {product.matchConfidence && <small>Confiança na correspondência: {product.matchConfidence === "high" ? "alta" : product.matchConfidence === "medium" ? "média" : "baixa"}</small>}
                    </span>
                    {Number.isFinite(product.estimatedSubtotal)
                      ? <b>{formatMoney(product.estimatedSubtotal)}</b>
                      : <b className="basket-estimate-no-price">Sem preço fiável</b>}
                  </div>;
                }) : <p className="basket-estimate-product-empty">O serviço ainda não devolveu detalhe por produto para esta estimativa. Atualiza para obter uma decomposição detalhada.</p>}
                {selectedStore.items?.length > 0 && <div className="basket-estimate-product-total"><span>Total estimado</span><strong>{formatMoney(selectedStore.estimatedTotal)}</strong></div>}
              </div>}
              {showPremiumPrompt && <div className="basket-estimate-premium-prompt"><strong>Gostaste da comparação?</strong><p>Esta foi a tua comparação gratuita. Com o Listoria Premium podes continuar a comparar o teu cabaz sempre que quiseres.</p><button type="button" onClick={() => window.dispatchEvent(new CustomEvent("listoria:open-premium"))}>Conhecer o Premium · 1,99 €/mês</button></div>}
              <p className="basket-estimate-disclaimer">{result.disclaimer}</p>
            </>}
          </>}
        </div>
      </section>
    </div>}
  </>;
}
