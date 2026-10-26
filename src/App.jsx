import { useState } from 'react';
import { ShoppingBasket, MapPin, Plus, Minus, Trash2, ShieldCheck, Database, Globe2, ArrowRight, CircleAlert, ChevronDown, Activity, Check, Info } from 'lucide-react';

const initial = [
  { id: 1, name: 'Leite meio-gordo', detail: '1 L · marca a confirmar', qty: 2 },
  { id: 2, name: 'Arroz agulha', detail: '1 kg · marca a confirmar', qty: 1 },
  { id: 3, name: 'Ovos tamanho M', detail: '12 unidades', qty: 1 },
  { id: 4, name: 'Azeite virgem extra', detail: '750 ml · marca a confirmar', qty: 1 },
];

function Pill({ children, tone = '' }) { return <span className={'pill ' + tone}>{children}</span>; }

export default function App() {
  const [items, setItems] = useState(initial);
  const [newItem, setNewItem] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [market, setMarket] = useState('PT');
  const [locationMode, setLocationMode] = useState('postal');
  const [showSources, setShowSources] = useState(true);
  const [message, setMessage] = useState('');
  const [attempted, setAttempted] = useState(false);
  const count = items.reduce((sum, item) => sum + item.qty, 0);

  function addItem(e) {
    e.preventDefault();
    const name = newItem.trim();
    if (!name) return;
    setItems(current => [...current, { id: Date.now(), name, detail: 'Produto por identificar', qty: 1 }]);
    setNewItem(''); setAttempted(false); setMessage('');
  }
  function changeQty(id, delta) {
    setItems(current => current.map(item => item.id === id ? { ...item, qty: item.qty + delta } : item).filter(item => item.qty > 0));
    setAttempted(false);
  }
  function compare() {
    if (!items.length) { setMessage('Adiciona pelo menos um produto à lista.'); return; }
    if (locationMode === 'postal' && !postalCode.trim()) { setMessage('Indica um código postal ou escolhe pesquisa sem localização.'); return; }
    setAttempted(true);
    setMessage('Ainda não existe uma fonte de preços autorizada configurada. Não foram inventados preços nem calculados totais.');
  }

  return <div className="shell">
    <header className="topbar"><a className="brand" href="#top"><span className="brandmark"><ShoppingBasket size={22}/></span><span><b>listoria</b><small>PREMIUM LAB</small></span></a><div className="top-actions"><Pill><i/> Ambiente de testes</Pill><a href="https://github.com/gui816/listoria-premium-lab" target="_blank" rel="noreferrer">Repositório <ArrowRight size={14}/></a></div></header>
    <main id="top">
      <section className="hero"><div><Pill tone="green"><Activity size={13}/> Fase 1 · Validação de dados</Pill><h1>O teu cabaz.<br/><em>Uma compra mais inteligente.</em></h1><p>Estamos a preparar a comparação de cabazes entre supermercados, começando por Portugal. Só apresentaremos preços reais com origem e data verificáveis.</p><div className="proof"><span><ShieldCheck size={16}/> Sem preços inventados</span><span><Globe2 size={16}/> Preparado para vários países</span></div></div><div className="hero-art"><div className="ring ring1"/><div className="ring ring2"/><div className="basket-art"><ShoppingBasket size={66}/></div><div className="float float-top"><MapPin size={17}/><span><b>Localização</b><small>Zona de pesquisa</small></span><Check size={15}/></div><div className="float float-bottom"><Database size={17}/><span><b>Dados verificáveis</b><small>Fonte + data + preço</small></span></div></div></section>
      <section className="stats"><div><span className="stat-icon amber"><Activity size={18}/></span><span><small>Estado dos dados</small><b>Fontes em validação</b></span></div><div><span className="stat-icon blue"><Database size={18}/></span><span><small>Preços reais ligados</small><b>0 fontes configuradas</b></span></div><div><span className="stat-icon purple"><Globe2 size={18}/></span><span><small>Mercado inicial</small><b>Portugal · EUR</b></span></div></section>
      <section className="section-title"><div><Pill>PROVA DE CONCEITO</Pill><h2>Prepara uma lista de teste</h2><p>Adiciona os produtos que costumas comprar. Esta lista ainda não consulta preços.</p></div><div className="total"><ShoppingBasket size={17}/><b>{count}</b><span>unidades</span></div></section>
      <div className="workspace"><section className="panel"><div className="panel-head"><div><h3>A tua lista de compras</h3><p>Produtos e quantidades para testar a correspondência.</p></div><Pill>{items.length} produtos</Pill></div><form className="add-form" onSubmit={addItem}><input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Adicionar produto (ex.: massa esparguete)" aria-label="Nome do produto"/><button disabled={!newItem.trim()}><Plus size={17}/> Adicionar</button></form><div className="items">{items.length === 0 && <p className="empty">A lista está vazia. Adiciona o primeiro produto.</p>}{items.map(item => <div className="item" key={item.id}><span className="item-icon"><ShoppingBasket size={19}/></span><span className="item-text"><b>{item.name}</b><small>{item.detail}</small></span><div className="qty"><button type="button" onClick={() => changeQty(item.id, -1)} aria-label="Diminuir quantidade"><Minus size={13}/></button><b>{item.qty}</b><button type="button" onClick={() => changeQty(item.id, 1)} aria-label="Aumentar quantidade"><Plus size={13}/></button></div><button className="remove" type="button" aria-label="Remover produto" onClick={() => setItems(current => current.filter(row => row.id !== item.id))}><Trash2 size={15}/></button></div>)}</div><div className="footnote"><Info size={15}/> As marcas e embalagens terão de ser confirmadas com os catálogos das fontes.</div></section>
      <aside className="panel location"><div className="panel-head"><div><h3>Onde costumas comprar?</h3><p>Para encontrar lojas com cobertura real de preços.</p></div><span className="loc-icon"><MapPin size={18}/></span></div><label htmlFor="market">Mercado</label><div className="select-wrap"><select id="market" value={market} onChange={e => setMarket(e.target.value)}><option value="PT">Portugal</option><option value="ES" disabled>Espanha — fase futura</option><option value="other" disabled>Outros países — fase futura</option></select><ChevronDown size={15}/></div><label>Como indicar a localização?</label><div className="toggle"><button type="button" className={locationMode === 'postal' ? 'active' : ''} onClick={() => setLocationMode('postal')}><MapPin size={14}/> Código postal</button><button type="button" className={locationMode === 'none' ? 'active' : ''} onClick={() => setLocationMode('none')}><Globe2 size={14}/> Sem localização</button></div>{locationMode === 'postal' && <><label htmlFor="postal">Código postal português</label><input id="postal" className="postal" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="Ex.: 2900-000"/></>}{locationMode === 'none' && <div className="hint"><ShieldCheck size={15}/> Só poderemos procurar fontes com cobertura nacional, se existirem.</div>}<div className="warning"><CircleAlert size={16}/> A proximidade de uma loja não garante que existam preços disponíveis dessa loja.</div><button className="primary" type="button" onClick={compare}>Validar comparação <ArrowRight size={16}/></button>{message && <div className="message" role="status">{message}</div>}{attempted && <div className="not-ready"><Database size={20}/><div><b>Fonte de preços ainda não ligada</b><p>O próximo passo é obter acesso autorizado e validar a cobertura do cabaz. Não foi calculado qualquer total.</p></div></div>}</aside></div>
      <section className="sources"><button className="source-toggle" onClick={() => setShowSources(v => !v)} aria-expanded={showSources}><span className="source-head-icon"><Database size={18}/></span><span className="source-head-text"><b>Fontes de preços em investigação</b><small>Integrações desativadas até serem validadas.</small></span><Pill tone="amber">0 ligadas</Pill><ChevronDown className={showSources ? 'rotated' : ''} size={17}/></button>{showSources && <div className="source-grid"><article><div className="source-icon blue"><Activity size={18}/><Pill tone="amber">A contactar</Pill></div><h4>SuperJarbas</h4><p>Anuncia dados para Continente, Pingo Doce e Auchan. Falta confirmar proposta, licença e acesso à API.</p><small><CircleAlert size={13}/> Permissões por confirmar</small></article><article><div className="source-icon purple"><Database size={18}/><Pill tone="amber">A validar</Pill></div><h4>Tacaro</h4><p>Anuncia preços e histórico de lojas online portuguesas; o acesso à API ainda não está aberto publicamente.</p><small><CircleAlert size={13}/> Acesso por confirmar</small></article><article><div className="source-icon green"><Globe2 size={18}/><Pill tone="blue">Complementar</Pill></div><h4>Open Prices</h4><p>Preços comunitários com prova, potencialmente úteis para observações em loja; não substituem um catálogo online completo.</p><small><CircleAlert size={13}/> Licença por rever</small></article></div>}<div className="trust-note"><ShieldCheck size={17}/><span><b>Princípio de confiança:</b> cada preço deverá ter fonte, data, moeda, modalidade e correspondência de produto fiável.</span></div></section>
      <section className="next"><div><small>PRÓXIMA ETAPA</small><h2>Ligar a primeira fonte real</h2><p>Antes de mostrar totais, vamos confirmar acesso comercial, cobertura por cadeia e atualização dos preços.</p></div><ul><li><Check size={14}/> Confirmar licença e condições da API</li><li><Check size={14}/> Validar amostra de 30–50 produtos</li><li><Check size={14}/> Medir cobertura, atualidade e custo</li></ul></section>
    </main><footer><a className="brand" href="#top"><span className="brandmark"><ShoppingBasket size={17}/></span><span><b>listoria</b><small>PREMIUM LAB</small></span></a><span>Laboratório independente · Não ligado à produção</span><span>Fase 1 · Validação de dados</span></footer>
  </div>;
}
