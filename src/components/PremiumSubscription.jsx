import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { trackEvent } from "../lib/analytics.js";
import { Sparkles, ShieldCheck, CreditCard, RefreshCw, CheckCircle2, FlaskConical, RotateCcw, CircleAlert, Ban } from "lucide-react";

const PLANS = [{ id:"monthly", name:"Mensal", price:"1,99 €", period:"por mês" }];

export default function PremiumSubscription({ session, language="pt-PT", compact=false }) {
 const [status,setStatus]=useState(null);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [demoPanel,setDemoPanel]=useState(false);
 const subscriptionTrackedRef=useRef(false);
 const isEnglish=language==="en";
 const refresh=useCallback(async()=>{
  if(!supabase||!session?.access_token)return;
  const {data,error:invokeError}=await supabase.functions.invoke("premium-status",{body:{}});
  if(invokeError){setError(isEnglish?"Could not load your subscription.":"Não foi possível carregar a subscrição.");return;}
  setStatus(data);
 },[session?.access_token,isEnglish]);
 useEffect(()=>{refresh();},[refresh]);
 useEffect(()=>{if(status?.isPremium&&!status?.isDemo&&!subscriptionTrackedRef.current){subscriptionTrackedRef.current=true;trackEvent("premium_subscription_active",{plan:"monthly",currency:"EUR",value:1.99});}},[status?.isPremium,status?.isDemo]);
 useEffect(()=>{const open=()=>{requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector(".premium-subscription-compact, .premium-subscription")?.scrollIntoView({behavior:"smooth",block:"center"})));};window.addEventListener("listoria:open-premium",open);return()=>window.removeEventListener("listoria:open-premium",open);},[]);
 const runDemoAction=async(action)=>{
  setBusy(action);setError("");
  try{
   const {data,error:invokeError}=await supabase.functions.invoke("premium-demo-manage",{body:{action}});
   if(invokeError){const detail=await invokeError.context?.json?.().catch(()=>null);throw new Error(detail?.error||invokeError.message);}
   setStatus(current=>({...current,isPremium:["active","past_due"].includes(data.subscription.status),subscription:{plan:"monthly",status:data.subscription.status,currentPeriodEnd:data.subscription.current_period_end,cancelAtPeriodEnd:data.subscription.cancel_at_period_end,graceUntil:data.subscription.past_due_grace_until},isDemo:true}));
   await refresh();
  }catch(e){setError(e.message||"Não foi possível atualizar a demonstração.");}
  finally{setBusy("");}
 };
 const openCheckout=async(plan)=>{
  setBusy(plan);setError("");
  trackEvent("begin_checkout",{plan,currency:"EUR",value:1.99});
  try{
   const {data,error:invokeError}=await supabase.functions.invoke("stripe-create-checkout",{body:{plan}});
   if(invokeError){const detail=await invokeError.context?.json?.().catch(()=>null);throw new Error(detail?.error||invokeError.message);}
   if(data?.demo){await refresh();setDemoPanel(true);return;}
   if(!data?.url)throw new Error(isEnglish?"Checkout URL was not returned.":"Não foi recebido o endereço de pagamento.");
   window.location.assign(data.url);
  }catch(e){setError(e.message||"Não foi possível iniciar o pagamento.");}
  finally{setBusy("");}
 };
 const openPortal=async()=>{
  setBusy("portal");setError("");
  try{
   const {data,error:invokeError}=await supabase.functions.invoke("stripe-create-portal",{body:{}});
   if(invokeError){const detail=await invokeError.context?.json?.().catch(()=>null);throw new Error(detail?.error||invokeError.message);}
   if(data?.demo){setDemoPanel(value=>!value);return;}
   if(!data?.url)throw new Error(isEnglish?"Management URL was not returned.":"Não foi recebido o endereço de gestão.");
   window.location.assign(data.url);
  }catch(e){setError(e.message||"Não foi possível abrir a gestão.");}
  finally{setBusy("");}
 };
 const premium=Boolean(status?.isPremium);
 const requiresAccount=Boolean(status?.requiresAccount);
 const demo=Boolean(status?.isDemo);
 const sub=status?.subscription;
 const demoStatus=sub?.status;
 if(compact) return <>
  <style>{`
   .premium-subscription-compact{margin:14px 0 18px;padding:15px 16px;border:1px solid #dce9df;border-radius:18px;background:linear-gradient(115deg,#f7faf5,#fff);box-shadow:0 5px 18px rgba(32,83,58,.045)}
   .premium-compact-top{display:flex;align-items:center;gap:11px}
   .premium-compact-icon{width:40px;height:40px;flex:0 0 40px;display:grid;place-items:center;border-radius:13px;background:#e5f1e6;color:#28694d}
   .premium-compact-copy{min-width:0;flex:1}
   .premium-compact-eyebrow{display:block;color:#47795f;font-size:10px;font-weight:800;letter-spacing:.12em}
   .premium-compact-title{display:block;margin-top:2px;color:#20372b;font-size:16px;font-weight:750;line-height:1.25}
   .premium-compact-description{display:block;margin-top:3px;color:#758178;font-size:12px;line-height:1.35}
   .premium-compact-price-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:13px}
   .premium-compact-price{color:#20372b;font-size:21px;font-weight:800;white-space:nowrap}
   .premium-compact-price small{font-size:11px;font-weight:500;color:#758178}
   .premium-compact-cta{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:0 16px;border:0;border-radius:13px;background:#28694d;color:white;font-size:13px;font-weight:750;cursor:pointer}
   .premium-compact-cta:disabled{opacity:.65;cursor:wait}
   .premium-compact-note{margin:9px 0 0;color:#89948c;font-size:11px;line-height:1.4}
   .premium-compact-status{display:flex;align-items:center;gap:7px;margin-top:10px;color:#28694d;font-size:12px;font-weight:700}
   .premium-compact-error{margin:9px 0 0;color:#b42318;font-size:12px}
   .premium-compact-demo{margin-top:8px;color:#8a7651;font-size:10px}
   @media(prefers-reduced-motion:reduce){.premium-subscription-compact *{scroll-behavior:auto!important}}
  `}</style>
  <section className="premium-subscription premium-subscription-compact" aria-label="Listoria Premium">
   <div className="premium-compact-top">
    <span className="premium-compact-icon"><Sparkles size={20}/></span>
    <div className="premium-compact-copy">
     <span className="premium-compact-eyebrow">LISTORIA PREMIUM</span>
     <strong className="premium-compact-title">{premium?(isEnglish?"Premium is active":"Premium ativo"):(isEnglish?"Keep comparing your basket":"Continua a comparar o teu cabaz")}</strong>
     <span className="premium-compact-description">{premium?(sub?.cancelAtPeriodEnd?(isEnglish?"Access remains active until the end of the paid period.":"Acesso ativo até ao fim do período pago."):demoStatus==="past_due"?(isEnglish?"Payment needs attention.":"O pagamento precisa de atenção."):(isEnglish?"Unlimited smart basket comparisons.":"Comparações inteligentes sem limite.")):(isEnglish?"Unlimited smart comparisons for €1.99/month.":"Comparações inteligentes ilimitadas por 1,99 €/mês.")}</span>
    </div>
   </div>
   {premium?<div className="premium-compact-status"><CheckCircle2 size={15}/>{isEnglish?"Subscription active":"Subscrição ativa"}<span style={{flex:1}}/><button type="button" className="premium-compact-cta" onClick={openPortal} disabled={Boolean(busy)}><CreditCard size={14}/>{isEnglish?"Manage":"Gerir"}</button></div>
   :requiresAccount?<p className="premium-compact-note">{isEnglish?"Create a Listora account to subscribe.":"Cria uma conta Listoria para subscrever o Premium."}</p>
   :<div className="premium-compact-price-row"><strong className="premium-compact-price">1,99 € <small>{isEnglish?"/ month":"/ mês"}</small></strong><button type="button" className="premium-compact-cta" onClick={()=>openCheckout("monthly")} disabled={Boolean(busy)}>{busy==="monthly"?(isEnglish?"Opening…":"A abrir…"):(isEnglish?"Activate Premium":"Ativar Premium")} <Sparkles size={14}/></button></div>}
   {demo&&<div className="premium-compact-demo">{isEnglish?"Demo mode · no real payment":"Modo de demonstração · sem pagamento real"} <button type="button" onClick={()=>setDemoPanel(value=>!value)}>{demoPanel?(isEnglish?"Hide test controls":"Ocultar testes"):(isEnglish?"Test":"Testar")}</button></div>}
   {demo&&demoPanel&&<div className="premium-demo-controls">
    <strong>{isEnglish?"Test subscription lifecycle":"Testar ciclo de vida da subscrição"}</strong>
    <div className="premium-demo-actions">
     {sub?.cancelAtPeriodEnd?<button type="button" onClick={()=>runDemoAction("reactivate")} disabled={Boolean(busy)}><RotateCcw size={14}/> {isEnglish?"Reactivate":"Reativar"}</button>:<button type="button" onClick={()=>runDemoAction("cancel")} disabled={Boolean(busy)}><Ban size={14}/> {isEnglish?"Cancel at period end":"Cancelar no fim do período"}</button>}
     {demoStatus==="past_due"?<button type="button" onClick={()=>runDemoAction("resolve_payment")} disabled={Boolean(busy)}><CheckCircle2 size={14}/> {isEnglish?"Resolve payment":"Regularizar pagamento"}</button>:<button type="button" onClick={()=>runDemoAction("simulate_payment_failure")} disabled={Boolean(busy)}><CircleAlert size={14}/> {isEnglish?"Simulate failed payment":"Simular falha de pagamento"}</button>}
     <button type="button" onClick={()=>runDemoAction("renew")} disabled={Boolean(busy)}><RefreshCw size={14}/> {isEnglish?"Renew":"Renovar"}</button>
     <button type="button" onClick={()=>runDemoAction("expire")} disabled={Boolean(busy)}><Ban size={14}/> {isEnglish?"Expire":"Expirar"}</button>
    </div>
   </div>}
   {error&&<p className="premium-compact-error" role="alert">{error}</p>}
   {!premium&&!requiresAccount&&<p className="premium-compact-note">{isEnglish?"Recurring monthly payment. Cancel anytime.":"Pagamento mensal recorrente. Cancela quando quiseres."}</p>}
  </section>
 </>;
 return <section className="premium-subscription">
  <div className="premium-subscription-heading">
   <span className="premium-subscription-icon"><Sparkles size={21}/></span>
   <div><span className="premium-eyebrow">LISTORIA PREMIUM</span><h2>{premium?(isEnglish?"Your Premium is active":"Tens o Premium ativo"):(isEnglish?"Unlock more from Listora":"Descobre o Listoria Premium")}</h2><p>{premium?(isEnglish?"Your smart basket comparison is ready.":"A comparação inteligente do cabaz está disponível."):(isEnglish?"Smart basket estimates and more intelligent shopping.":"Estimativas inteligentes do cabaz e compras mais informadas.")}</p></div>
   {premium&&<span className="premium-active-pill"><CheckCircle2 size={13}/>{isEnglish?"Active":"Ativo"}</span>}
  </div>
  {demo&&<div className="premium-demo-banner"><FlaskConical size={16}/><span><strong>{isEnglish?"Demo mode":"Modo de demonstração"}</strong> · {isEnglish?"No payment will be taken. Full Premium flow is simulated.":"Sem pagamentos reais. O funcionamento Premium está a ser simulado."}</span></div>}
  {!premium&&<div className="premium-benefits"><span><CheckCircle2 size={14}/> {isEnglish?"Smart basket comparison":"Comparação inteligente do cabaz"}</span><span><CheckCircle2 size={14}/> {isEnglish?"Unlimited use with fair-use protection":"Utilização sem limite, com proteção contra abuso"}</span></div>}
  {premium?<div className="premium-subscription-active">
   <div><strong>{isEnglish?"Monthly":"Mensal"} · {demo?(isEnglish?"Demo subscription":"Subscrição de demonstração"):""}</strong><small>{sub?.cancelAtPeriodEnd?(isEnglish?"Cancellation scheduled":"Cancelamento agendado"):demoStatus==="past_due"?(isEnglish?"Payment grace period (3 days)":"Período de regularização (3 dias)"):(isEnglish?"Recurring subscription active":"Subscrição recorrente ativa")}{sub?.currentPeriodEnd?" · até "+new Date(sub.currentPeriodEnd).toLocaleDateString(language):""}</small></div>
   <button type="button" onClick={openPortal} disabled={Boolean(busy)}><CreditCard size={16}/>{isEnglish?"Manage subscription":"Gerir subscrição"}</button>
  </div>:requiresAccount?<p className="premium-account-note">{isEnglish?"Create a Listora account before subscribing.":"Cria uma conta Listoria antes de subscrever."}</p>:<div className="premium-plans">
   {PLANS.map(plan=><article className="premium-plan premium-plan-featured" key={plan.id}>
    <strong>{isEnglish?"Monthly":plan.name}</strong><b>{plan.price}</b><small>{plan.period}</small>
    <button type="button" onClick={()=>openCheckout("monthly")} disabled={Boolean(busy)}>{busy===plan.id?(isEnglish?"Opening…":"A abrir…"):(isEnglish?"Subscribe":"Subscrever")}</button>
   </article>)}
  </div>}
  {demo&&demoPanel&&<div className="premium-demo-controls">
   <strong>{isEnglish?"Test subscription lifecycle":"Testar ciclo de vida da subscrição"}</strong>
   <p>{isEnglish?"Change the simulated subscription state to test the UI and access rules.":"Altera o estado simulado para testar a interface e as regras de acesso."}</p>
   <div className="premium-demo-actions">
    {sub?.cancelAtPeriodEnd?<button type="button" onClick={()=>runDemoAction("reactivate")} disabled={Boolean(busy)}><RotateCcw size={14}/> {isEnglish?"Reactivate":"Reativar"}</button>:<button type="button" onClick={()=>runDemoAction("cancel")} disabled={Boolean(busy)}><Ban size={14}/> {isEnglish?"Cancel at period end":"Cancelar no fim do período"}</button>}
    {demoStatus==="past_due"?<button type="button" onClick={()=>runDemoAction("resolve_payment")} disabled={Boolean(busy)}><CheckCircle2 size={14}/> {isEnglish?"Resolve payment":"Regularizar pagamento"}</button>:<button type="button" onClick={()=>runDemoAction("simulate_payment_failure")} disabled={Boolean(busy)}><CircleAlert size={14}/> {isEnglish?"Simulate failed payment":"Simular falha de pagamento"}</button>}
    <button type="button" onClick={()=>runDemoAction("renew")} disabled={Boolean(busy)}><RefreshCw size={14}/> {isEnglish?"Renew 30 days":"Renovar 30 dias"}</button>
    <button type="button" onClick={()=>runDemoAction("expire")} disabled={Boolean(busy)}><Ban size={14}/> {isEnglish?"Expire subscription":"Expirar subscrição"}</button>
   </div>
   <small>{isEnglish?"Demo controls only affect this test account.":"Estas ações só alteram a subscrição de demonstração desta conta."}</small>
  </div>}
  {error&&<p className="premium-error" role="alert">{error}</p>}
  <p className="premium-footnote"><ShieldCheck size={13}/>{demo?(isEnglish?"Demo only — no payment method or Stripe account is required.":"Demonstração — não é necessário método de pagamento nem conta Stripe."):(isEnglish?"Secure recurring payment via Stripe Checkout. Cancel or update your plan at any time.":"Pagamento recorrente seguro através do Stripe Checkout. Podes gerir ou cancelar a subscrição.")}</p>
  <button type="button" className="premium-refresh" onClick={refresh} disabled={Boolean(busy)}><RefreshCw size={13}/>{isEnglish?"Refresh subscription status":"Atualizar estado da subscrição"}</button>
 </section>;
}
