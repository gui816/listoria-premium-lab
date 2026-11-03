import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { Sparkles, LoaderCircle, RefreshCw, Globe2, ChevronDown } from "lucide-react";

const COUNTRY_STORAGE_KEY = "listora-country-code";
const getInitialCountry = () => {
  const saved = localStorage.getItem(COUNTRY_STORAGE_KEY);
  if (saved) return saved.toUpperCase();
  try {
    const region = new Intl.Locale(navigator.language || "pt-PT").region;
    return region || "PT";
  } catch {
    return "PT";
  }
};
const money = (value, locale, currency) =>
  new Intl.NumberFormat(locale || "pt-PT", { style: "currency", currency: currency || "EUR" }).format(value);

export default function BasketEstimate({ items, language = "pt-PT" }) {
  const [countries, setCountries] = useState([]);
  const [countryCode, setCountryCode] = useState(getInitialCountry);
  const [supermarkets, setSupermarkets] = useState([]);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);
  const [error, setError] = useState("");

  const country = useMemo(() => countries.find((entry) => entry.code === countryCode), [countries, countryCode]);

  useEffect(() => {
    let active = true;
    const loadCountries = async () => {
      if (!supabase) {
        setError("O catálogo de países não está disponível. Confirma a configuração do Supabase.");
        setLoadingCatalogue(false);
        return;
      }
      const { data, error: queryError } = await supabase
        .from("countries")
        .select("code,name,flag_emoji,currency_code,currency_locale,default_language")
        .order("display_order", { ascending: true });
      if (!active) return;
      if (queryError) {
        setError("Não foi possível carregar os países suportados.");
      } else {
        setCountries(data || []);
        if (data?.length && !data.some((entry) => entry.code === countryCode)) {
          const fallback = data.find((entry) => entry.code === "PT") || data[0];
          setCountryCode(fallback.code);
          localStorage.setItem(COUNTRY_STORAGE_KEY, fallback.code);
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
    setResult(null);
    setError("");
    const loadSupermarkets = async () => {
      const { data, error: queryError } = await supabase
        .from("supermarkets")
        .select("id,name,price_position,website,display_order")
        .eq("country_code", countryCode)
        .order("display_order", { ascending: true });
      if (!active) return;
      if (queryError) {
        setError("Não foi possível carregar os supermercados deste país.");
        setSupermarkets([]);
        setSelected([]);
        return;
      }
      const entries = data || [];
      setSupermarkets(entries);
      const saved = localStorage.getItem("listora-supermarkets-" + countryCode);
      let savedNames = null;\n      try { savedNames = saved ? JSON.parse(saved) : null; } catch { savedNames = null; }
      const validSaved = Array.isArray(savedNames)
        ? entries.filter((entry) => savedNames.includes(entry.name)).map((entry) => entry.name)
        : [];
      setSelected(validSaved.length ? validSaved : entries.slice(0, 5).map((entry) => entry.name));
    };
    loadSupermarkets();
    return () => { active = false; };
  }, [countryCode]);

  const changeCountry = (nextCode) => {
    setCountryCode(nextCode);
    localStorage.setItem(COUNTRY_STORAGE_KEY, nextCode);
    setResult(null);
    setError("");
  };

  const toggleSupermarket = (name) => {
    setSelected((current) => {
      const next = current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name];
      localStorage.setItem("listora-supermarkets-" + countryCode, JSON.stringify(next));
      setResult(null);
      return next;
    });
  };

  const estimate = async () => {
    if (!items?.length || busy) return;
    if (!countryCode) {
      setError("Seleciona o país para estimar o cabaz.");
      return;
    }
    if (!selected.length) {
      setError("Seleciona pelo menos um supermercado.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("listora-basket-estimate", {
        body: {
          items: items.map((item) => ({ name: item.name, quantity: item.quantity || 1, unit: item.unit || "un" })),
          countryCode,
          supermarkets: selected
        }
      });
      if (invokeError) {
        const detail = await invokeError.context?.json?.().catch(() => null);
        throw new Error(detail?.error || invokeError.message);
      }
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (estimateError) {
      setError(estimateError.message || "Não foi possível estimar o cabaz.");
    } finally {
      setBusy(false);
    }
  };

  const formatMoney = (value) => money(value, country?.currency_locale || language, result?.currency || country?.currency_code || "EUR");

  return <section className="basket-estimate">
    <div className="basket-estimate-intro">
      <span className="basket-estimate-icon"><Sparkles size={18} /></span>
      <div>
        <strong>Quanto poderá custar o teu cabaz?</strong>
        <p>Escolhe o país e os supermercados que costumas utilizar. A estimativa é indicativa.</p>
      </div>
    </div>

    <div className="basket-estimate-country" style={{ display: "grid", gap: 8, margin: "16px 0" }}>
      <label htmlFor="basket-estimate-country" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}><Globe2 size={16} /> País</label>
      <div className="basket-estimate-select-wrap" style={{ position: "relative" }}>
        <select id="basket-estimate-country" value={countryCode} onChange={(event) => changeCountry(event.target.value)} disabled={loadingCatalogue || busy} style={{ width: "100%", minHeight: 44, padding: "10px 38px 10px 12px", border: "1px solid var(--border, #d1d5db)", borderRadius: 10, background: "var(--surface, #fff)", color: "inherit", font: "inherit", appearance: "none" }}>
          {countries.map((entry) => <option key={entry.code} value={entry.code}>{entry.flag_emoji} {entry.name}</option>)}
        </select>
        <ChevronDown size={16} aria-hidden="true" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      </div>
    </div>

    <div className="basket-estimate-supermarkets" style={{ margin: "16px 0" }}>
      <div className="basket-estimate-supermarkets-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Supermercados</strong>
        <span>{selected.length} selecionados</span>
      </div>
      <div className="basket-estimate-supermarkets-list" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {supermarkets.map((store) => (
          <label key={store.id} className="basket-estimate-supermarket-option" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 10px", border: "1px solid var(--border, #d1d5db)", borderRadius: 999, fontSize: 13 }}>
            <input type="checkbox" checked={selected.includes(store.name)} onChange={() => toggleSupermarket(store.name)} disabled={busy} />
            <span>{store.name}</span>
          </label>
        ))}
      </div>
    </div>

    {!result && <button type="button" className="basket-estimate-button" onClick={estimate} disabled={busy || loadingCatalogue || !items?.length || !selected.length}>
      {busy ? <><LoaderCircle className="spin" size={17} /> A estimar o cabaz…</> : <><Sparkles size={17} /> Estimar preço do cabaz</>}
    </button>}

    {error && <p className="basket-estimate-error" role="alert">{error}</p>}

    {result && <div className="basket-estimate-results">
      <div className="basket-estimate-results-heading">
        <strong>Estimativa em {result.country?.name || country?.name}</strong>
        <button type="button" onClick={() => { setResult(null); setError(""); }} aria-label="Nova estimativa"><RefreshCw size={16} /></button>
      </div>
      {result.stores?.map((store, index) => (
        <article className="basket-estimate-store" key={store.name + index}>
          <div>
            <strong>{store.name}</strong>
            {store.website && <small><a href={store.website} target="_blank" rel="noreferrer">Website oficial</a> · confiança {store.confidence === "high" ? "alta" : store.confidence === "medium" ? "média" : "baixa"}</small>}
          </div>
          {store.status === "estimated" ? (
            <div className="basket-estimate-price">
              <strong>{formatMoney(store.estimatedTotal)}</strong>
              <span>{formatMoney(store.estimatedRange.min)} – {formatMoney(store.estimatedRange.max)}</span>
            </div>
          ) : <span className="basket-estimate-unavailable">Dados insuficientes</span>}
        </article>
      ))}
      <p className="basket-estimate-disclaimer">{result.disclaimer}</p>
      <button type="button" className="basket-estimate-retry" onClick={estimate} disabled={busy}>Atualizar estimativa</button>
    </div>}
  </section>;
}
