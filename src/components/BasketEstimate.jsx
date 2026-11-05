import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import {
  Sparkles, LoaderCircle, Globe2, ChevronDown, X, MapPin,
  ShoppingBasket, ChevronRight, ArrowLeft, Clock3, CheckCircle2
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

export default function BasketEstimate({ items, language = "pt-PT" }) {
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
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [stale, setStale] = useState(false);

  const country = useMemo(() => countries.find((entry) => entry.code === countryCode), [countries, countryCode]);
  const cleanItems = useMemo(() => normaliseItems(items), [items]);
  const itemSignature = useMemo(() => JSON.stringify(cleanItems), [cleanItems]);
  const cacheKey = useMemo(() => {
    if (!countryCode || !selected.length || !cleanItems.length) return "";
    return "listora-basket-estimate-v4:" + countryCode + ":" + [...selected].sort().join("|") + ":" + itemSignature;
  }, [countryCode, selected, itemSignature, cleanItems.length]);

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
    setBusy(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("listora-basket-estimate", {
        body: { items: cleanItems, countryCode, supermarkets: selected }
      });
      if (invokeError) {
        const detail = await invokeError.context?.json?.().catch(() => null);
        throw new Error(detail?.error || invokeError.message);
      }
      if (data?.error) throw new Error(data.error);
      setResult(data);
      setSelectedStore(null);
      setStale(false);
      try {
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
        localStorage.setItem("listora-basket-last-signature", itemSignature);
      } catch {}
    } catch (estimateError) {
      setError(estimateError.message || "Não foi possível estimar o cabaz.");
    } finally {
      setBusy(false);
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
    <section className="basket-estimate">
      <div className="basket-estimate-summary">
        <span className="basket-estimate-icon"><Sparkles size={22}/></span>
        <div className="basket-estimate-summary-copy">
          
          <strong>Quanto custa o teu cabaz?</strong>
          {bestStore && !stale ? <>
            <b>{formatMoney(bestStore.estimatedTotal)} <small>· {bestStore.name}</small></b>
            <span>Compara supermercados</span>
          </> : <span>Compara supermercados</span>}
        </div>
        <button type="button" className="basket-estimate-open" onClick={openModal}>
          <Sparkles size={16}/><span>{bestStore && !stale ? "Ver comparação" : "Estimar cabaz"}</span><ChevronRight size={17}/>
        </button>
      </div>
      {stale && <p className="basket-estimate-stale-note">A lista foi alterada. Atualiza a estimativa para refletir os produtos atuais.</p>}
    </section>

    {open && <div className="basket-estimate-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className="basket-estimate-modal" role="dialog" aria-modal="true" aria-labelledby="basket-estimate-title">
        <header className="basket-estimate-modal-header">
          <div><span className="basket-estimate-modal-kicker"><Sparkles size={14}/> COMPARAÇÃO INTELIGENTE</span><h2 id="basket-estimate-title">Quanto poderá custar o teu cabaz?</h2><p>{cleanItems.length} produtos na lista</p><p className="basket-estimate-quality-hint">A IA pesquisa na Web os produtos e preços disponíveis, procurando primeiro correspondências exatas e depois alternativas equivalentes. Quando não encontra preços verificáveis, apresenta estimativas.</p></div>
          <button type="button" className="basket-estimate-modal-close" onClick={() => setOpen(false)} disabled={busy} aria-label="Fechar"><X size={20}/></button>
        </header>

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

            {!result && <button type="button" className="basket-estimate-button" onClick={() => estimate(false)} disabled={busy || loadingCatalogue || !cleanItems.length || !selected.length}>
              {busy ? <><LoaderCircle className="spin" size={17}/> A estimar o cabaz…</> : <><Sparkles size={17}/> Estimar preço do cabaz</>}
            </button>}

            {error && <p className="basket-estimate-error" role="alert">{error}</p>}

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
                    no_reliable_match: "Sem correspondência fiável"
                  };
                  return <div className="basket-estimate-product-row" key={product.name + index}>
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.quantity} × {product.unit} · {matchLabels[product.matchType] || "Correspondência por validar"}</small>
                      {product.matchedProductName && <small className="basket-estimate-matched-product">Produto considerado: {product.matchedProductName}{product.packageSize ? " · " + product.packageSize : ""}</small>}
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
              <p className="basket-estimate-disclaimer">{result.disclaimer}</p>
            </>}
          </>}
        </div>
      </section>
    </div>}
  </>;
}
