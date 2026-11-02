import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { MapPin, Sparkles, LoaderCircle, RefreshCw } from "lucide-react";
const money=(n,lang)=>new Intl.NumberFormat(lang||"pt-PT",{style:"currency",currency:"EUR"}).format(n);
export default function BasketEstimate({items,language="pt-PT"}){
 const [result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const estimate=()=>{
  if(!items?.length||busy)return;setBusy(true);setError("");
  if(!navigator.geolocation){setError("Este dispositivo não disponibiliza a localização.");setBusy(false);return;}
  navigator.geolocation.getCurrentPosition(async({coords})=>{
   try{
    const {data,error:invokeError}=await supabase.functions.invoke("listora-basket-estimate",{body:{items:items.map(x=>({name:x.name,quantity:x.quantity||1,unit:x.unit||"un"})),location:{latitude:coords.latitude,longitude:coords.longitude,radiusKm:10},currency:"EUR",language}});
    if(invokeError){const detail=await invokeError.context?.json?.().catch(()=>null);throw new Error(detail?.error||invokeError.message);}
    if(data?.error)throw new Error(data.error);setResult(data);
   }catch(e){setError(e.message||"Não foi possível estimar o cabaz.");}finally{setBusy(false);}
  },e=>{setError(e.code===1?"A localização foi recusada. Permite o acesso nas definições do navegador e tenta novamente.":"Não foi possível obter a localização. Confirma que o GPS está ativo.");setBusy(false);},{enableHighAccuracy:false,timeout:15000,maximumAge:300000});
 };
 return <section className="basket-estimate">
  <div className="basket-estimate-intro"><span className="basket-estimate-icon"><Sparkles size={18}/></span><div><strong>Quanto poderá custar o teu cabaz?</strong><p>Compara estimativas nas cadeias encontradas até 10 km de distância.</p></div></div>
  {!result&&<button type="button" className="basket-estimate-button" onClick={estimate} disabled={busy||!items?.length}>{busy?<><LoaderCircle className="spin" size={17}/> A procurar lojas e a estimar…</>:<><MapPin size={17}/> Estimar preço do cabaz</>}</button>}
  {error&&<p className="basket-estimate-error" role="alert">{error}</p>}
  {result&&<div className="basket-estimate-results"><div className="basket-estimate-results-heading"><strong>Estimativa por supermercado</strong><button type="button" onClick={()=>{setResult(null);setError("");}} aria-label="Nova estimativa"><RefreshCw size={16}/></button></div>
   {result.stores?.map((s,i)=><article className="basket-estimate-store" key={s.chain+i}><div><strong>{s.chain}</strong><small>{s.nearbyStores} {s.nearbyStores===1?"loja encontrada":"lojas encontradas"} · confiança {s.confidence==="high"?"alta":s.confidence==="medium"?"média":"baixa"}</small></div>{s.status==="estimated"?<div className="basket-estimate-price"><strong>{money(s.estimatedTotal,language)}</strong><span>{money(s.estimatedRange.min,language)} – {money(s.estimatedRange.max,language)}</span></div>:<span className="basket-estimate-unavailable">Dados insuficientes</span>}</article>)}
   <p className="basket-estimate-disclaimer">{result.disclaimer}</p><p className="basket-estimate-coverage">{result.coverageNote}</p><button type="button" className="basket-estimate-retry" onClick={estimate} disabled={busy}>Atualizar estimativa</button>
  </div>}
 </section>;
}