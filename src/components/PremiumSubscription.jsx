import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { Sparkles, ShieldCheck, CreditCard, RefreshCw, CheckCircle2, FlaskConical, RotateCcw, CircleAlert, Ban } from "lucide-react";

const PLANS = [{ id:"monthly", name:"Mensal", price:"1,99 €", period:"por mês" }];

export default function PremiumSubscription({ session, language="pt-PT" }) {
 const [status,setStatus]=useState(null);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [demoPanel,setDemoPanel]=useState(false);
 const isEnglish=language==="en";
 const refresh=useCallback(async()=>{
  if(!supabase||!session?.access_token)return;
  const {data,error:invokeError}=await supabase.functions.invoke("premium-status",{body:{}});
  if(invokeError){setError(isEnglish?"Could not load your subscription.":"Não foi possível carregar a subscrição.");return;}
  setStatus(data);
 },[session?.access_token,isEnglish]);
 useEffect(()=>{refresh();},[refresh]);
 useEffect(()=>{const open=()=>document.querySelector(".premium-subscription")?.scrollIntoView({behavior:"smooth",block:"center"});window.addEventListener("listoria:open-premium",open);return()=>window.removeEventListener("listoria:open-premium",open);},[]);
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
