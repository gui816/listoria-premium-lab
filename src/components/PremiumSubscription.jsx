import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { Sparkles, ShieldCheck, CreditCard, RefreshCw, CheckCircle2 } from "lucide-react";

const PLANS = [
 { id:"monthly", name:"Mensal", price:"2,99 €", period:"por mês" },
 { id:"quarterly", name:"Trimestral", price:"5,99 €", period:"a cada 3 meses" },
 { id:"half_yearly", name:"Semestral", price:"9,99 €", period:"a cada 6 meses" }
];

export default function PremiumSubscription({ session, language="pt-PT" }) {
 const [status,setStatus]=useState(null);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const isEnglish=language==="en";
 const refresh=useCallback(async()=>{
  if(!supabase||!session?.access_token)return;
  const {data,error:invokeError}=await supabase.functions.invoke("premium-status",{body:{}});
  if(invokeError){setError(isEnglish?"Could not load your subscription.":"Não foi possível carregar a subscrição.");return;}
  setStatus(data);
 },[session?.access_token,isEnglish]);
 useEffect(()=>{refresh();},[refresh]);
 const openCheckout=async(plan)=>{
  setBusy(plan);setError("");
  try{
   const {data,error:invokeError}=await supabase.functions.invoke("stripe-create-checkout",{body:{plan}});
   if(invokeError){const detail=await invokeError.context?.json?.().catch(()=>null);throw new Error(detail?.error||invokeError.message);}
   if(!data?.url)throw new Error(isEnglish?"Checkout URL was not returned.":"Não foi recebido o endereço de pagamento.");
   window.location.assign(data.url);
  }catch(e){setError(e.message||"Não foi possível iniciar o pagamento.");setBusy("");}
 };
 const openPortal=async()=>{
  setBusy("portal");setError("");
  try{
   const {data,error:invokeError}=await supabase.functions.invoke("stripe-create-portal",{body:{}});
   if(invokeError){const detail=await invokeError.context?.json?.().catch(()=>null);throw new Error(detail?.error||invokeError.message);}
   if(!data?.url)throw new Error(isEnglish?"Management URL was not returned.":"Não foi recebido o endereço de gestão.");
   window.location.assign(data.url);
  }catch(e){setError(e.message||"Não foi possível abrir a gestão.");setBusy("");}
 };
 const premium=Boolean(status?.isPremium);
 const requiresAccount=Boolean(status?.requiresAccount);
 return <section className="premium-subscription">
  <div className="premium-subscription-heading">
   <span className="premium-subscription-icon"><Sparkles size={21}/></span>
   <div><span className="premium-eyebrow">LISTORIA PREMIUM</span><h2>{premium?(isEnglish?"Your Premium is active":"Tens o Premium ativo"):(isEnglish?"Unlock more from Listora":"Descobre o Listoria Premium")}</h2><p>{premium?(isEnglish?"Your smart basket comparison is ready.":"A comparação inteligente do cabaz está disponível."):(isEnglish?"Smart basket estimates and more intelligent shopping.":"Estimativas inteligentes do cabaz e compras mais informadas.")}</p></div>
   {premium&&<span className="premium-active-pill"><CheckCircle2 size={13}/>{isEnglish?"Active":"Ativo"}</span>}
  </div>
  {!premium&&<div className="premium-benefits"><span><CheckCircle2 size={14}/> {isEnglish?"Smart basket comparison":"Comparação inteligente do cabaz"}</span><span><CheckCircle2 size={14}/> {isEnglish?"Unlimited use, subject to fair-use protection":"Utilização sem limite, com proteção contra abuso"}</span></div>}
  {premium?<div className="premium-subscription-active">
   <div><strong>{status.subscription?.plan==="monthly"?"Mensal":status.subscription?.plan==="quarterly"?"Trimestral":"Semestral"}</strong><small>{status.subscription?.cancelAtPeriodEnd?"Cancelamento agendado":status.subscription?.status==="past_due"?"Período de regularização do pagamento":"Subscrição recorrente ativa"}{status.subscription?.currentPeriodEnd?" · até "+new Date(status.subscription.currentPeriodEnd).toLocaleDateString(language):""}</small></div>
   <button type="button" onClick={openPortal} disabled={Boolean(busy)}><CreditCard size={16}/>{isEnglish?"Manage subscription":"Gerir subscrição"}</button>
  </div>:requiresAccount?<p className="premium-account-note">{isEnglish?"Create a Listora account to subscribe. Your guest lists can stay on this device.":"Cria uma conta Listora para subscrever. As tuas listas de convidado continuam disponíveis neste dispositivo."}</p>:<div className="premium-plans">
   {PLANS.map(plan=><article className={plan.id==="half_yearly"?"premium-plan premium-plan-featured":"premium-plan"} key={plan.id}>
    {plan.id==="half_yearly"&&<span className="premium-plan-tag">{isEnglish?"Best value":"Melhor valor"}</span>}
    <strong>{isEnglish?({monthly:"Monthly",quarterly:"Quarterly",half_yearly:"6 months"}[plan.id]):plan.name}</strong>
    <b>{plan.price}</b><small>{plan.period}</small>
    <button type="button" onClick={()=>openCheckout(plan.id)} disabled={Boolean(busy)}>{busy===plan.id?(isEnglish?"Opening…":"A abrir…"):(isEnglish?"Subscribe":"Subscrever")}</button>
   </article>)}
  </div>}
  {error&&<p className="premium-error" role="alert">{error}</p>}
  <p className="premium-footnote"><ShieldCheck size={13}/>{isEnglish?"Secure recurring payment via Stripe Checkout. Cancel or update your plan at any time.":"Pagamento recorrente seguro através do Stripe Checkout. Podes gerir ou cancelar a subscrição."}</p>
  <button type="button" className="premium-refresh" onClick={refresh} disabled={Boolean(busy)}><RefreshCw size={13}/>{isEnglish?"Refresh subscription status":"Atualizar estado da subscrição"}</button>
 </section>;
}
