import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, CalendarDays, Check, ChevronDown, LoaderCircle, Minus, Plus, Refrigerator, Search, ShoppingBasket, Trash2 } from "lucide-react";
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

export default function InventoryArea({ shareCode, onAddToShopping }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("outros");
  const [location, setLocation] = useState("despensa");
  const [expiryDate, setExpiryDate] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const loadItems = useCallback(async () => {
    if (!shareCode) { setItems([]); setLoading(false); return; }
    setLoading(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("get_family_inventory", { p_share_code: shareCode });
    if (rpcError) setError("Não foi possível carregar os produtos em casa. Confirma se a atualização da base de dados já foi aplicada.");
    else setItems(Array.isArray(data?.items) ? data.items : []);
    setLoading(false);
  }, [shareCode]);

  useEffect(() => { void loadItems(); }, [loadItems]);

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
    else { setItems(data?.items || []); setName(""); setQuantity("1"); setExpiryDate(""); }
    setSaving(false);
  }

  async function changeQuantity(item, delta) {
    const nextQuantity = Math.max(0, Math.min(999, Number(item.quantity || 0) + delta));
    const { data, error: rpcError } = await supabase.rpc("update_family_inventory_item", {
      p_share_code: shareCode, p_item_id: item.id, p_quantity: nextQuantity
    });
    if (rpcError) setError("Não foi possível atualizar a quantidade.");
    else setItems(data?.items || []);
  }

  async function removeItem(item) {
    const { data, error: rpcError } = await supabase.rpc("delete_family_inventory_item", { p_share_code: shareCode, p_item_id: item.id });
    if (rpcError) setError("Não foi possível remover o produto.");
    else setItems(data?.items || []);
  }

  async function addToShopping(item) {
    if (!onAddToShopping) return;
    const success = await onAddToShopping(item);
    if (success) {
      const { data, error: rpcError } = await supabase.rpc("record_inventory_restock_request", { p_share_code: shareCode, p_item_id: item.id });
      if (!rpcError && data?.items) setItems(data.items);
    }
  }

  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const lowStock = items.filter(item => Number(item.quantity || 0) <= 1).length;
  const expiringSoon = items.filter(item => item.expiry_date && new Date(item.expiry_date + "T23:59:59") <= new Date(Date.now() + 5 * 86400000)).length;

  return <section className="inventory-area">
    <header className="inventory-heading"><div><span className="eyebrow">A TUA CASA</span><h1>O que tens em casa</h1><p>Os produtos disponíveis para a tua família.</p></div><span className="inventory-heading-icon"><Refrigerator size={25}/></span></header>
    <div className="inventory-stats">
      <div><strong>{items.length}</strong><span>Produtos</span></div><div><strong>{totalUnits}</strong><span>Unidades</span></div><div><strong>{lowStock}</strong><span>Stock baixo</span></div>
    </div>
    {expiringSoon > 0 && <div className="inventory-expiry-alert"><CalendarDays size={17}/><span>{expiringSoon} {expiringSoon === 1 ? "produto próximo" : "produtos próximos"} da validade</span></div>}
    <form className="inventory-add-form" onSubmit={addItem}>
      <div className="inventory-form-heading"><div><strong>Adicionar a Em casa</strong><small>Regista apenas o essencial. Podes completar depois.</small></div><Archive size={19}/></div>
      <label htmlFor="inventory-name">Produto</label><input id="inventory-name" value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Leite, arroz, maçãs…" maxLength={100} required/>
      <div className="inventory-form-grid"><div><label htmlFor="inventory-quantity">Quantidade</label><input id="inventory-quantity" type="number" inputMode="numeric" min="1" max="999" value={quantity} onChange={event => setQuantity(event.target.value)}/></div><div><label htmlFor="inventory-category">Categoria</label><select id="inventory-category" value={category} onChange={event => setCategory(event.target.value)}>{INVENTORY_CATEGORIES.map(option => <option key={option.id} value={option.id}>{option.emoji} {option.label}</option>)}</select></div></div>
      <div className="inventory-form-grid"><div><label htmlFor="inventory-location">Onde guardas?</label><select id="inventory-location" value={location} onChange={event => setLocation(event.target.value)}>{STORAGE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div><div><label htmlFor="inventory-expiry">Validade (opcional)</label><input id="inventory-expiry" type="date" value={expiryDate} onChange={event => setExpiryDate(event.target.value)}/></div></div>
      <button className="primary-button" type="submit" disabled={saving || !name.trim()}>{saving ? <LoaderCircle size={17} className="spin"/> : <Plus size={17}/>} Adicionar produto</button>
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
        <div className="inventory-item-actions"><button type="button" className="inventory-restock" onClick={() => void addToShopping(item)}><ShoppingBasket size={15}/> Repor</button><button type="button" className="inventory-remove" aria-label={"Remover " + item.name} onClick={() => void removeItem(item)}><Trash2 size={15}/></button></div>
      </article>;
    })}</div>}
    <p className="inventory-footnote"><Check size={14}/> As alterações ficam sincronizadas com a lista da família.</p>
  </section>;
}
