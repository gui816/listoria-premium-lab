import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { Sparkles, LoaderCircle, X, Plus, Check, ExternalLink, RefreshCw, ShoppingBasket, Leaf } from "lucide-react";

const COPY = {
  pt: {
    title: "Sugerir produtos", subtitle: "Descobre produtos que combinam com o que procuras.",
    promptLabel: "O que procuras?", placeholder: "Ex.: produtos biológicos, sem glúten, ricos em proteína e sem açúcar adicionado…",
    examples: ["Biológicos", "Sem glúten", "Ricos em proteína", "Sem lactose", "Económicos"],
    search: "Sugerir produtos", searching: "A procurar produtos…", results: "Sugestões para ti",
    add: "Adicionar selecionados", addOne: "Adicionar", added: "adicionado(s) à lista",
    selected: "selecionados", noResults: "Não encontrámos sugestões suficientemente relevantes. Experimenta descrever de outra forma.",
    error: "Não foi possível pesquisar produtos. Tenta novamente.", sources: "Fontes consultadas",
    country: "Pesquisa adaptada a", listContext: "A considerar a tua lista atual para evitar repetições.",
    close: "Fechar", newSearch: "Nova pesquisa", grounded: "Produto encontrado numa fonte online",
    suggestion: "Sugestão de produto", noLink: "Sem página de produto confirmada",
    intro: "Diz-me que tipos de produtos procuras", disclaimer: "As sugestões são indicativas. Confirma sempre os ingredientes, alergénios, certificações e informação da embalagem antes de comprar."
  },
  en: {
    title: "Suggest products", subtitle: "Discover products that match what you are looking for.",
    promptLabel: "What are you looking for?", placeholder: "E.g. organic, gluten-free, high-protein products with no added sugar…",
    examples: ["Organic", "Gluten-free", "High protein", "Lactose-free", "Budget-friendly"],
    search: "Suggest products", searching: "Searching for products…", results: "Suggestions for you",
    add: "Add selected", addOne: "Add", added: "added to your list",
    selected: "selected", noResults: "We couldn't find sufficiently relevant suggestions. Try describing your needs differently.",
    error: "Couldn't search for products. Please try again.", sources: "Sources consulted",
    country: "Search tailored to", listContext: "Your current list is considered to avoid duplicates.",
    close: "Close", newSearch: "New search", grounded: "Product found in an online source",
    suggestion: "Product idea", noLink: "No confirmed product page",
    intro: "Tell me what types of products you're looking for", disclaimer: "Suggestions are indicative. Always check ingredients, allergens, certifications and package information before buying."
  }
};

const getCountryCode = () => {
  try { return (localStorage.getItem("listora-country-code") || "PT").toUpperCase(); }
  catch { return "PT"; }
};
const cacheKey = (query, country, items) => "listora-product-suggestions-v1:" + country + ":" + query.trim().toLocaleLowerCase() + ":" + items.map((x) => x.name).sort().join("|");

export default function ProductSuggestions({ items = [], language = "pt-PT", onAddProduct }) {
  const en = !String(language).toLowerCase().startsWith("pt");
  const c = en ? COPY.en : COPY.pt;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [countryCode, setCountryCode] = useState(getCountryCode);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);
  const [sources, setSources] = useState([]);
  const [selected, setSelected] = useState([]);
  const [notice, setNotice] = useState("");

  const existingNames = useMemo(() => new Set(items.map((item) => String(item.name || "").trim().toLocaleLowerCase())), [items]);
  const openModal = () => {
    setCountryCode(getCountryCode());
    setOpen(true);
    setError("");
    setNotice("");
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => { if (event.key === "Escape" && !busy && !adding) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, busy, adding]);

  const search = async (force = false) => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 3 || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    setSelected([]);
    const key = cacheKey(cleanQuery, countryCode, items);
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || "null");
        if (cached?.savedAt && Date.now() - cached.savedAt < 4 * 60 * 60 * 1000 && Array.isArray(cached.results)) {
          setResults(cached.results);
          setSources(cached.sources || []);
          setBusy(false);
          return;
        }
      } catch {}
    }
    try {
      if (!supabase) throw new Error("Supabase indisponível.");
      const { data, error: invokeError } = await supabase.functions.invoke("listora-product-suggestions", {
        body: {
          query: cleanQuery,
          countryCode,
          language: en ? "en" : "pt",
          existingItems: items.map((item) => ({ name: item.name, quantity: item.quantity, unit: item.unit })).slice(0, 60)
        }
      });
      if (invokeError) {
        const detail = await invokeError.context?.json?.().catch(() => null);
        throw new Error(detail?.error || invokeError.message);
      }
      if (data?.error) throw new Error(data.error);
      const safeResults = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setResults(safeResults);
      setSources(Array.isArray(data?.sources) ? data.sources : []);
      try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), results: safeResults, sources: data?.sources || [] })); } catch {}
    } catch (err) {
      setError(err?.message || c.error);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  const addSelected = async () => {
    if (!selected.length || adding) return;
    setAdding(true);
    setError("");
    let count = 0;
    for (const id of selected) {
      const product = results.find((entry) => entry.id === id);
      if (!product || existingNames.has(String(product.name || "").toLocaleLowerCase())) continue;
      const ok = await onAddProduct(product.name, 1, "auto", true);
      if (ok) count++;
    }
    setAdding(false);
    setNotice(count + " " + c.added);
    setSelected([]);
    if (count) setResults((current) => current.filter((entry) => !existingNames.has(String(entry.name || "").toLocaleLowerCase()) && !selected.includes(entry.id)));
  };

  return <>
    <section className="product-suggestions-tool">
      <div className="product-suggestions-summary">
        <span className="product-suggestions-icon"><Leaf size={22}/></span>
        <div className="product-suggestions-copy">
          <strong>{c.title}</strong>
          <span>{c.subtitle}</span>
        </div>
        <button type="button" className="product-suggestions-open" onClick={openModal}>
          <Sparkles size={16}/><span>{c.title}</span>
        </button>
      </div>
    </section>

    {open && <div className="product-suggestions-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy && !adding) setOpen(false); }}>
      <section className="product-suggestions-modal" role="dialog" aria-modal="true" aria-labelledby="product-suggestions-title">
        <header className="product-suggestions-header">
          <div>
            <span className="product-suggestions-kicker"><Sparkles size={14}/> LISTORIA AI</span>
            <h2 id="product-suggestions-title">{c.intro}</h2>
            <p>{c.country}: {countryCode}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} disabled={busy || adding} aria-label={c.close}><X size={20}/></button>
        </header>

        <div className="product-suggestions-content">
          <label htmlFor="product-suggestions-query">{c.promptLabel}</label>
          <textarea id="product-suggestions-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={c.placeholder} rows={3} maxLength={500} disabled={busy || adding}/>
          <div className="product-suggestions-examples">
            {c.examples.map((example) => <button type="button" key={example} onClick={() => setQuery((current) => current ? current + ", " + example.toLocaleLowerCase() : example.toLocaleLowerCase())} disabled={busy || adding}>{example}</button>)}
          </div>
          <p className="product-suggestions-context"><ShoppingBasket size={14}/>{c.listContext}</p>
          <button type="button" className="product-suggestions-search" onClick={() => search(false)} disabled={busy || query.trim().length < 3}>
            {busy ? <><LoaderCircle className="spin" size={18}/>{c.searching}</> : <><Sparkles size={17}/>{c.search}</>}
          </button>

          {error && <p className="product-suggestions-error" role="alert">{error}</p>}
          {notice && <p className="product-suggestions-notice" role="status"><Check size={16}/>{notice}</p>}

          {results.length > 0 && <>
            <div className="product-suggestions-results-heading"><strong>{c.results}</strong><button type="button" onClick={() => search(true)} disabled={busy || adding}><RefreshCw size={14}/>{c.newSearch}</button></div>
            <div className="product-suggestions-results">
              {results.map((product) => {
                const alreadyAdded = existingNames.has(String(product.name || "").toLocaleLowerCase());
                return <article className={"product-suggestion-card" + (selected.includes(product.id) ? " selected" : "")} key={product.id}>
                  <button type="button" className="product-suggestion-select" onClick={() => toggle(product.id)} disabled={alreadyAdded || adding} aria-pressed={selected.includes(product.id)}>
                    <span className="product-suggestion-check">{selected.includes(product.id) ? <Check size={15}/> : <Plus size={15}/>}</span>
                    <span className="product-suggestion-details">
                      <strong>{product.name}</strong>
                      {product.brand && <small>{product.brand}</small>}
                      <span>{product.category || ""}{product.attributes?.length ? " · " + product.attributes.join(" · ") : ""}</span>
                      <small>{product.reason || ""}</small>
                      {product.url && <small className="product-suggestion-source"><ExternalLink size={12}/>{product.sourceName || c.grounded}</small>}
                      {!product.url && <small className="product-suggestion-source">{c.noLink}</small>}
                      {alreadyAdded && <small className="product-suggestion-already">Já está na lista</small>}
                    </span>
                  </button>
                  <span className="product-suggestion-tag">{product.confidence === "high" ? "●" : product.confidence === "medium" ? "◐" : "○"}</span>
                </article>;
              })}
            </div>
            {sources.length > 0 && <div className="product-suggestions-sources"><strong>{c.sources}</strong>{sources.slice(0, 6).map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title || source.url}</a>)}</div>}
            <p className="product-suggestions-disclaimer">{c.disclaimer}</p>
            <button type="button" className="product-suggestions-add" onClick={addSelected} disabled={!selected.length || adding}>
              {adding ? <><LoaderCircle className="spin" size={17}/>…</> : <><Plus size={17}/>{c.add} ({selected.length})</>}
            </button>
          </>}
          {results.length === 0 && !busy && !error && query.trim().length >= 3 && notice === "" && null}
        </div>
      </section>
    </div>}
  </>;
}
