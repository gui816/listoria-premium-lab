import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronDown, LoaderCircle, Minus, Plus, Refrigerator, Search, ShoppingBasket, Trash2, X } from "lucide-react";
import ProductEntryComposer from "./ProductEntryComposer.jsx";
import { supabase } from "../lib/supabase.js";

const INVENTORY_CATEGORIES = [
  { id: "fruta", label: "Fruta e legumes", emoji: "🥑" },
  { id: "frescos", label: "Frescos", emoji: "🥛" },
  { id: "despensa", label: "Despensa", emoji: "🥫" },
  { id: "limpeza", label: "Limpeza", emoji: "🧽" },
  { id: "outros", label: "Outros", emoji: "📦" }
];
const STORAGE_OPTIONS = [
  { id: "frigorifico", label: "Frigorífico" },
  { id: "congelador", label: "Congelador" },
  { id: "despensa", label: "Despensa" },
  { id: "outro", label: "Outro" }
];

export default function InventoryArea({ shareCode, language = "pt-PT", onAddToShopping, onNotify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("outros");
  const [location, setLocation] = useState("despensa");
  const [expiryDate, setExpiryDate] = useState("");
  const [capturedItems, setCapturedItems] = useState([]);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureListening, setCaptureListening] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [captureSource, setCaptureSource] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const captureFileRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const voiceTranscriptRef = useRef("");
  const recognitionFailedRef = useRef(false);
  const voiceResultHandledRef = useRef(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [inventoryListVisible, setInventoryListVisible] = useState(false);
  const [inventoryNudgeDismissed, setInventoryNudgeDismissed] = useState(false);
  const channelRef = useRef(null);

  const loadItems = useCallback(async () => {
    if (!shareCode) { setItems([]); setLoading(false); return; }
    setLoading(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("get_family_inventory", { p_share_code: shareCode });
    if (rpcError) setError("Não foi possível carregar os produtos em casa. Confirma se a atualização da base de dados já foi aplicada.");
    else setItems(Array.isArray(data?.items) ? data.items : []);
    setLoading(false);
  }, [shareCode]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  useEffect(() => {
    const heading = document.querySelector(".inventory-list-heading");
    if (!heading) return undefined;
    const updateVisibility = () => {
      const bounds = heading.getBoundingClientRect();
      setInventoryListVisible(bounds.top < window.innerHeight * 0.84 && bounds.bottom > window.innerHeight * 0.12);
    };
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [items.length, loading]);

  useEffect(() => { setInventoryNudgeDismissed(false); }, [items.length]);

  useEffect(() => {
    if (!shareCode) return undefined;
    const channel = supabase.channel(`inventory:${shareCode}`, {
      config: { broadcast: { self: false } }
    });
    channel.on("broadcast", { event: "changed" }, () => { void loadItems(); }).subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [shareCode, loadItems]);

  function broadcastInventoryChange() {
    channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} });
  }

  const filteredItems = useMemo(() => items.filter(item => {
    const matchesSearch = !search || item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
    const matchesCategory = filter === "all" || item.category === filter;
    return matchesSearch && matchesCategory;
  }), [items, search, filter]);

  async function addItem(event) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || !shareCode || saving) return;
    setSaving(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("add_family_inventory_item", {
      p_share_code: shareCode, p_name: cleanName, p_quantity: Math.max(1, Math.min(999, Number.parseInt(quantity, 10) || 1)),
      p_category: category, p_storage_location: location, p_expiry_date: expiryDate || null
    });
    if (rpcError) setError("Não foi possível guardar. A atualização da base de dados pode ainda não estar aplicada.");
    else { setItems(data?.items || []); setName(""); setQuantity("1"); setExpiryDate(""); broadcastInventoryChange(); onNotify?.(`${cleanName} adicionado a Em casa`); }
    setSaving(false);
  }

  function inferInventoryCategory(productName) {
    const value = productName.toLocaleLowerCase();
    if (/maçã|banana|laranja|tomate|batata|cebola|alface|cenoura|brócolo|abacate|fruta|legume|pera|uva|limão|morango/.test(value)) return "fruta";
    if (/leite|iogurte|queijo|manteiga|ovo|carne|frango|peixe|salmão|fiambre|presunto|natas|requeijão/.test(value)) return "frescos";
    if (/detergente|lixívia|lixivia|limpeza|sabão|sabonete|champô|shampoo|pasta de dentes|desinfetante|papel higiénico/.test(value)) return "limpeza";
    return "despensa";
  }

  async function extractCapturedItems(payload, source) {
    setCaptureBusy(true);
    setCaptureListening(false);
    setCaptureError("");
    setCaptureSource(source);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("listora-list-extract", { body: payload });
      if (invokeError) {
        let detail = invokeError.message || "Não foi possível contactar o serviço de interpretação.";
        try {
          const response = invokeError.context;
          if (response && typeof response.json === "function") {
            const body = await response.json();
            detail = body?.error || body?.message || detail;
          }
        } catch { /* Keep the original error. */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      const found = (Array.isArray(data?.items) ? data.items : [])
        .map(item => ({ name: String(item?.name || item?.product || "").trim().replace(/\s+/g, " ").slice(0, 100), quantity: Math.max(1, Math.min(999, Number.parseInt(item?.quantity, 10) || 1)) }))
        .filter(item => item.name).slice(0, 60);
      if (!found.length) throw new Error("Não identificámos produtos. Tenta uma fotografia mais nítida ou fala novamente.");
      setCapturedItems(found);
    } catch (err) {
      setCaptureError(err.message || "Não foi possível interpretar os produtos. Tenta novamente.");
    } finally {
      setCaptureBusy(false);
      if (source === "voice") setVoiceModalOpen(false);
    }
  }

  async function processCapturePhoto(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setCaptureError("Escolhe uma fotografia em formato JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setCaptureError("A fotografia deve ter menos de 12 MB.");
      return;
    }
    setCaptureBusy(true);
    setCaptureSource("photo");
    setCaptureError("");
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Não foi possível ler a fotografia."));
        reader.readAsDataURL(file);
      });
      const [header, fileData] = dataUrl.split(",");
      const mimeType = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
      await extractCapturedItems({ text: "", mimeType, fileData }, "photo");
    } catch (err) {
      setCaptureError(err.message || "Não foi possível ler a fotografia.");
      setCaptureBusy(false);
    } finally {
      if (captureFileRef.current) captureFileRef.current.value = "";
    }
  }

  function clearVoiceSilenceTimer() {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function startVoiceCapture() {
    if (captureListening) {
      clearVoiceSilenceTimer();
      recognitionRef.current?.stop();
      return;
    }
    setCaptureError("");
    setVoiceTranscript("");
    voiceTranscriptRef.current = "";
    recognitionFailedRef.current = false;
    voiceResultHandledRef.current = false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setCaptureError("O reconhecimento de voz não está disponível neste navegador. Podes usar o microfone do teclado no campo de produto.");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language || "pt-PT";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
      setVoiceModalOpen(true);

      recognition.onstart = () => setCaptureListening(true);
      recognition.onresult = event => {
        const transcript = Array.from(event.results || [])
          .map(result => result?.[0]?.transcript || "")
          .join(" ")
          .trim();
        if (!transcript) return;

        voiceTranscriptRef.current = transcript;
        setVoiceTranscript(transcript);
        clearVoiceSilenceTimer();
        silenceTimerRef.current = window.setTimeout(() => {
          recognition.stop();
        }, 3000);
      };
      recognition.onerror = event => {
        if (recognitionFailedRef.current) return;
        recognitionFailedRef.current = true;
        clearVoiceSilenceTimer();
        setCaptureListening(false);
        setVoiceModalOpen(false);
        setCaptureError(event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "O acesso ao microfone foi recusado. Permite o microfone nas definições do navegador."
          : event.error === "no-speech"
            ? "Não detetámos voz. Toca no microfone e fala depois de aparecer a indicação de escuta."
            : event.error === "network"
              ? "O reconhecimento de voz precisa de uma ligação à Internet. Verifica a ligação e tenta novamente."
              : "Não foi possível reconhecer a voz. Tenta novamente.");
      };
      recognition.onend = () => {
        clearVoiceSilenceTimer();
        setCaptureListening(false);
        if (recognitionFailedRef.current || voiceResultHandledRef.current) return;

        const transcript = voiceTranscriptRef.current.trim();
        if (!transcript) {
          setVoiceModalOpen(false);
          setCaptureError("Não detetámos voz. Tenta novamente.");
          return;
        }

        voiceResultHandledRef.current = true;
        setVoiceTranscript(transcript);
        void extractCapturedItems({ text: transcript, mimeType: "", fileData: "" }, "voice");
      };
      recognition.start();
    } catch {
      clearVoiceSilenceTimer();
      setCaptureListening(false);
      setVoiceModalOpen(false);
      setCaptureError("Não foi possível iniciar o microfone neste dispositivo.");
    }
  }

  function stopVoiceCapture() {
    clearVoiceSilenceTimer();
    if (recognitionRef.current && captureListening) {
      recognitionRef.current.stop();
    }
  }

  useEffect(() => () => {
    clearVoiceSilenceTimer();
    recognitionRef.current?.abort();
  }, []);

  function updateCapturedItem(index, changes) {
    setCapturedItems(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  async function confirmCapturedItems() {
    const valid = capturedItems.filter(item => item.name.trim());
    if (!valid.length || captureBusy || saving) return;
    setCaptureBusy(true);
    setCaptureError("");
    let insertedCount = 0;
    try {
      for (const item of valid) {
        const categoryId = inferInventoryCategory(item.name);
        const storageLocation = categoryId === "frescos" ? "frigorifico" : "despensa";
        const { data, error: rpcError } = await supabase.rpc("add_family_inventory_item", {
          p_share_code: shareCode,
          p_name: item.name.trim().slice(0, 100),
          p_quantity: Math.max(1, Math.min(999, Number.parseInt(item.quantity, 10) || 1)),
          p_category: categoryId,
          p_storage_location: storageLocation,
          p_expiry_date: null
        });
        if (rpcError) throw new Error("Não foi possível guardar todos os produtos. Verifica a ligação e tenta novamente.");
        setItems(data?.items || []);
        insertedCount += 1;
      }
      setCapturedItems([]);
      setVoiceTranscript("");
      broadcastInventoryChange();
      const addedNames = valid.slice(0, 3).map(item => item.name).join(", ");
      const remaining = valid.length - Math.min(valid.length, 3);
      onNotify?.(`${addedNames}${remaining > 0 ? ` +${remaining}` : ""} — ${valid.length} ${valid.length === 1 ? "produto adicionado a Em casa" : "produtos adicionados a Em casa"}`);
    } catch (err) {
      if (insertedCount > 0) setCapturedItems(valid.slice(insertedCount));
      setCaptureError(err.message || "Não foi possível guardar os produtos.");
    } finally {
      setCaptureBusy(false);
    }
  }

  async function changeQuantity(item, delta) {
    const nextQuantity = Math.max(0, Math.min(999, Number(item.quantity || 0) + delta));
    const { data, error: rpcError } = await supabase.rpc("update_family_inventory_item", {
      p_share_code: shareCode, p_item_id: item.id, p_quantity: nextQuantity
    });
    if (rpcError) setError("Não foi possível atualizar a quantidade.");
    else { setItems(data?.items || []); broadcastInventoryChange(); }
  }

  async function removeItem(item) {
    const { data, error: rpcError } = await supabase.rpc("delete_family_inventory_item", { p_share_code: shareCode, p_item_id: item.id });
    if (rpcError) setError("Não foi possível remover o produto.");
    else { setItems(data?.items || []); broadcastInventoryChange(); }
  }

  async function clearAllItems() {
    if (!items.length || clearing) return;
    const count = items.length;
    const confirmed = window.confirm(`Queres remover os ${count} ${count === 1 ? "produto" : "produtos"} de Em casa? Esta ação afeta todos os membros da família e não pode ser desfeita.`);
    if (!confirmed) return;

    setClearing(true);
    setError("");
    let remainingItems = items;
    try {
      for (const item of items) {
        const { data, error: rpcError } = await supabase.rpc("delete_family_inventory_item", {
          p_share_code: shareCode,
          p_item_id: item.id
        });
        if (rpcError) throw rpcError;
        remainingItems = Array.isArray(data?.items)
          ? data.items
          : remainingItems.filter(current => current.id !== item.id);
        setItems(remainingItems);
      }
      broadcastInventoryChange();
      onNotify?.(`${count} ${count === 1 ? "produto removido" : "produtos removidos"} de Em casa`);
    } catch (err) {
      setError("Não foi possível remover todos os produtos. Atualizámos a lista com as alterações já efetuadas.");
      await loadItems();
    } finally {
      setClearing(false);
    }
  }

  async function addToShopping(item) {
    if (!onAddToShopping) return;
    const success = await onAddToShopping(item);
    if (success) {
      const { data, error: rpcError } = await supabase.rpc("record_inventory_restock_request", { p_share_code: shareCode, p_item_id: item.id });
      if (!rpcError && data?.items) { setItems(data.items); broadcastInventoryChange(); }
    }
  }

  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const lowStock = items.filter(item => Number(item.quantity || 0) <= 1).length;
  const expiringSoon = items.filter(item => item.expiry_date && new Date(item.expiry_date + "T23:59:59") <= new Date(Date.now() + 5 * 86400000)).length;

  return <section className="inventory-area">
    <header className="inventory-heading area-page-heading"><div className="area-page-heading-copy"><span className="eyebrow">A TUA CASA</span><h1>O que tens em casa</h1><p>Os produtos disponíveis para a tua família.</p></div><span className="area-page-heading-icon"><Refrigerator size={25}/></span></header>
    <div className="inventory-stats">
      <div><strong>{items.length}</strong><span>Produtos</span></div><div><strong>{totalUnits}</strong><span>Unidades</span></div><div><strong>{lowStock}</strong><span>Stock baixo</span></div>
    </div>
    {expiringSoon > 0 && <div className="inventory-expiry-alert"><CalendarDays size={17}/><span>{expiringSoon} {expiringSoon === 1 ? "produto próximo" : "produtos próximos"} da validade</span></div>}
    <form className="inventory-add-form" onSubmit={addItem}>
      <ProductEntryComposer
        value={name}
        onChange={event => setName(event.target.value)}
        placeholder="Ex.: Leite, arroz, maçãs…"
        addLabel="Adicionar produto"
        title="Adicionar produtos"
        description="Escreve, diz ou fotografa uma lista de produtos."
        onVoice={startVoiceCapture}
        onPhoto={() => captureFileRef.current?.click()}
        busy={captureBusy || saving}
        listening={captureListening}
      />
      <input ref={captureFileRef} className="inventory-capture-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void processCapturePhoto(event.target.files?.[0]); }} />
      {captureError && <p className="inventory-error" role="alert">{captureError}</p>}
      {voiceModalOpen && <div className="modal-backdrop voice-modal-backdrop" onClick={() => { if (captureBusy) return; recognitionFailedRef.current = true; clearVoiceSilenceTimer(); recognitionRef.current?.abort(); setCaptureListening(false); setVoiceModalOpen(false); }}>
        <section className="share-modal voice-modal voice-listening-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="inventory-voice-title">
          <button type="button" className="modal-close" aria-label="Fechar" disabled={captureBusy} onClick={() => { recognitionFailedRef.current = true; clearVoiceSilenceTimer(); recognitionRef.current?.abort(); setCaptureListening(false); setVoiceModalOpen(false); }}><X size={20}/></button>
          <div className={`voice-listening-icon${captureBusy ? " is-processing" : ""}`}>{captureBusy ? <LoaderCircle size={30} className="spin"/> : <Mic size={30}/>}</div>
          <span className={`voice-listening-pill${captureBusy ? " is-processing" : ""}`}><span/> {captureBusy ? "A identificar" : "A ouvir"}</span>
          <h2 id="inventory-voice-title">{captureBusy ? "A identificar os produtos" : "Estou a ouvir!"}</h2>
          <p>{captureBusy ? "Estamos a organizar os produtos que disseste. Só mais um momento." : "Diz-me que produtos já tens em casa."}</p>
          {captureBusy ? <div className="voice-transcript-panel"><small>O que percebemos</small><strong>“{voiceTranscript}”</strong><div className="voice-processing-note"><LoaderCircle size={15} className="spin"/>A identificar produtos e quantidades…</div></div> : <>
            {voiceTranscript && <div className="voice-transcript-panel"><small>O que percebemos</small><strong>“{voiceTranscript}”</strong></div>}
            <div className="voice-wave" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/><span/><span/></div>
            <div className="voice-listening-example"><small>Podes dizer vários produtos de seguida</small><strong>“Leite, arroz, maçãs e dois iogurtes.”</strong></div>
          </>}
          <button type="button" className="primary-button voice-stop-button" disabled={captureBusy || !captureListening} onClick={stopVoiceCapture}>{captureBusy ? <><LoaderCircle size={17} className="spin"/>A identificar…</> : <><Mic size={17}/>Terminar gravação</>}</button>
          <small className="voice-listening-hint">{captureBusy ? "Não feches esta janela. Estamos quase a terminar." : "Também termina automaticamente após 3 segundos de silêncio."}</small>
        </section>
      </div>}
      {capturedItems.length > 0 && <div className="modal-backdrop" onClick={() => !captureBusy && setCapturedItems([])}>
        <section className="share-modal import-modal inventory-capture-preview" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="inventory-capture-title">
          <button type="button" className="modal-close" aria-label="Fechar" disabled={captureBusy} onClick={() => setCapturedItems([])}><X size={20}/></button>
          <div className="share-graphic"><ShoppingBasket size={28}/></div>
          <h2 id="inventory-capture-title">Confirmar produtos</h2>
          <p>{captureSource === "photo" ? "Revê os produtos reconhecidos na fotografia." : "Revê os produtos reconhecidos por voz."} Podes corrigir nomes e quantidades antes de os adicionar ao inventário.</p>
          <div className="import-preview-list">{capturedItems.map((item, index) => <div className="import-preview-row" key={index}>
            <input aria-label={`Produto ${index + 1}`} value={item.name} maxLength={100} onChange={event => updateCapturedItem(index, { name: event.target.value })}/>
            <input aria-label={`Quantidade de ${item.name}`} type="number" min="1" max="999" value={item.quantity} onChange={event => updateCapturedItem(index, { quantity: event.target.value })}/>
            <button type="button" aria-label={`Remover ${item.name}`} disabled={captureBusy} onClick={() => setCapturedItems(previous => previous.filter((_, itemIndex) => itemIndex !== index))}><X size={17}/></button>
          </div>)}</div>
          {captureError && <p className="error-message" role="alert">{captureError}</p>}
          <button type="button" className="primary-button" disabled={captureBusy || !capturedItems.some(item => item.name.trim())} onClick={() => void confirmCapturedItems()}>{captureBusy ? <LoaderCircle size={17} className="spin"/> : <Check size={17}/>} {captureBusy ? "A adicionar…" : `Adicionar ${capturedItems.length} ${capturedItems.length === 1 ? "produto" : "produtos"} a Em casa`}</button>
          <button type="button" className="secondary-button" disabled={captureBusy} onClick={() => { setCapturedItems([]); setCaptureError(""); }}>Cancelar</button>
        </section>
      </div>}
      <details className="inventory-add-details">
        <summary>Detalhes opcionais <ChevronDown size={15}/></summary>
        <div className="inventory-form-grid"><div><label htmlFor="inventory-quantity">Quantidade</label><input id="inventory-quantity" type="number" inputMode="numeric" min="1" max="999" value={quantity} onChange={event => setQuantity(event.target.value)}/></div><div><label htmlFor="inventory-category">Categoria</label><select id="inventory-category" value={category} onChange={event => setCategory(event.target.value)}>{INVENTORY_CATEGORIES.map(option => <option key={option.id} value={option.id}>{option.emoji} {option.label}</option>)}</select></div></div>
        <div className="inventory-form-grid"><div><label htmlFor="inventory-location">Onde guardas?</label><select id="inventory-location" value={location} onChange={event => setLocation(event.target.value)}>{STORAGE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div><div><label htmlFor="inventory-expiry">Validade (opcional)</label><input id="inventory-expiry" type="date" value={expiryDate} onChange={event => setExpiryDate(event.target.value)}/></div></div>
      </details>
    </form>
    <div className="inventory-list-heading"><div><h2>Os teus produtos</h2><span>{items.length} registados</span></div><div className="inventory-search"><Search size={16}/><input aria-label="Pesquisar produtos" value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar"/></div></div>
    <nav className="inventory-filters" aria-label="Filtrar inventário"><button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Tudo</button>{INVENTORY_CATEGORIES.map(option => <button type="button" key={option.id} className={filter === option.id ? "active" : ""} onClick={() => setFilter(option.id)}>{option.emoji} {option.label}</button>)}</nav>
    {error && <p className="inventory-error" role="alert">{error}</p>}
    {loading ? <div className="inventory-loading"><LoaderCircle className="spin" size={22}/> A carregar os produtos…</div> : filteredItems.length === 0 ? <div className="inventory-empty"><span>🏡</span><strong>{search || filter !== "all" ? "Não encontrámos produtos." : "Ainda não tens produtos registados."}</strong><p>{search || filter !== "all" ? "Experimenta alterar a pesquisa ou o filtro." : "Começa por adicionar alguns produtos que já tens em casa."}</p></div> : <div className="inventory-items">{filteredItems.map(item => {
      const categoryInfo = INVENTORY_CATEGORIES.find(option => option.id === item.category);
      const locationInfo = STORAGE_OPTIONS.find(option => option.id === item.storage_location);
      const expiry = item.expiry_date ? new Date(item.expiry_date + "T12:00:00") : null;
      const isExpired = expiry && expiry < new Date(new Date().toDateString());
      return <article className={Number(item.quantity) === 0 ? "inventory-item is-empty" : "inventory-item"} key={item.id}>
        <span className="inventory-item-emoji">{categoryInfo?.emoji || "📦"}</span><div className="inventory-item-copy"><strong>{item.name}</strong><small>{locationInfo?.label || "Em casa"}{expiry ? " · Validade " + expiry.toLocaleDateString("pt-PT") : ""}</small>{isExpired && <em>Validade ultrapassada</em>}</div>
        <div className="inventory-quantity"><button type="button" aria-label="Diminuir quantidade" onClick={() => void changeQuantity(item,-1)} disabled={Number(item.quantity) <= 0}><Minus size={14}/></button><strong>{item.quantity}</strong><button type="button" aria-label="Aumentar quantidade" onClick={() => void changeQuantity(item,1)}><Plus size={14}/></button></div>
        <div className="inventory-item-actions"><button type="button" className="inventory-restock" onClick={() => void addToShopping(item)}><ShoppingBasket size={15}/>Adicionar a Compras</button><button type="button" className="inventory-remove" aria-label={"Remover " + item.name} onClick={() => void removeItem(item)}><Trash2 size={15}/></button></div>
      </article>;
    })}</div>}
    {items.length > 0 && !loading && <button type="button" className="inventory-clear-all" onClick={() => void clearAllItems()} disabled={clearing}>
      {clearing ? <LoaderCircle className="spin" size={16}/> : <Trash2 size={16}/>}
      {clearing ? "A remover produtos…" : "Remover todos os produtos"}
    </button>}
    <p className="inventory-footnote"><Check size={14}/> As alterações ficam sincronizadas com a lista da família.</p>
    {items.length > 0 && !loading && !inventoryListVisible && !inventoryNudgeDismissed && <button type="button" className="shopping-list-floating-nudge inventory-list-floating-nudge" onClick={() => document.querySelector(".inventory-list-heading")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span className="shopping-nudge-icon"><Refrigerator size={23}/></span><span className="shopping-nudge-copy"><strong>{items.length} {items.length === 1 ? "produto em casa" : "produtos em casa"}</strong><small>Desliza para ver</small></span><span className="shopping-nudge-divider"/><span className="shopping-nudge-chevron"><ChevronDown size={22}/><ChevronDown size={22}/></span><span className="shopping-nudge-close" aria-label="Fechar aviso" onClick={event => { event.stopPropagation(); setInventoryNudgeDismissed(true); }}><X size={16}/></span></button>}
  </section>;
}
