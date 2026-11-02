import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const round=(n:number)=>Math.round(n*100)/100;
const normalize=(raw:string)=>{
 const v=raw.toLocaleLowerCase("pt-PT");
 const brands:Array<[RegExp,string]>=[[/continente|modelo|bom dia/,"Continente"],[/pingo\s*doce/,"Pingo Doce"],[/lidl/,"Lidl"],[/aldi/,"Aldi"],[/mercadona/,"Mercadona"],[/auchan|jumbo/,"Auchan"],[/intermarch[eé]/,"Intermarché"],[/minipre[cç]o/,"Minipreço"],[/spar/,"SPAR"],[/el corte inglés/,"El Corte Inglés"]];
 return brands.find(([p])=>p.test(v))?.[1]||raw.trim();
};
serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST") return json({error:"Método não permitido."},405);
 try{
  const key=Deno.env.get("GEMINI_API_KEY"); if(!key) return json({error:"O serviço de estimativa não está configurado (GEMINI_API_KEY)."},503);
  const body=await req.json(); const items=Array.isArray(body?.items)?body.items:[]; const lat=Number(body?.location?.latitude),lon=Number(body?.location?.longitude);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) return json({error:"Localização inválida."},400);
  if(!items.length||items.length>60) return json({error:"A lista deve conter entre 1 e 60 artigos por comprar."},400);
  const basket=items.map((x:any)=>({name:String(x?.name||"").trim().replace(/\s+/g," ").slice(0,100),quantity:Math.max(1,Math.min(999,Number(x?.quantity)||1)),unit:String(x?.unit||"un").slice(0,12)})).filter((x:any)=>x.name);
  if(!basket.length) return json({error:"Não foram encontrados artigos válidos."},400);
  const q='[out:json][timeout:20];(node["shop"~"supermarket|convenience|department_store"](around:10000,'+lat+','+lon+');way["shop"~"supermarket|convenience|department_store"](around:10000,'+lat+','+lon+');relation["shop"~"supermarket|convenience|department_store"](around:10000,'+lat+','+lon+'););out center tags;';
  const overpassEndpoints=[
   "https://overpass-api.de/api/interpreter",
   "https://overpass.kumi.systems/api/interpreter",
   "https://overpass.private.coffee/api/interpreter"
  ];
  let osm:any=null;
  const endpointErrors:string[]=[];
  for(const endpoint of overpassEndpoints){
   try{
    const response=await fetch(endpoint,{
     method:"POST",
     headers:{"Content-Type":"application/x-www-form-urlencoded"},
     body:"data="+encodeURIComponent(q),
     signal:AbortSignal.timeout(12000)
    });
    if(!response.ok){
     endpointErrors.push(new URL(endpoint).hostname+" returned HTTP "+response.status);
     continue;
    }
    osm=await response.json();
    if(Array.isArray(osm?.elements)) break;
    endpointErrors.push(new URL(endpoint).hostname+" returned an invalid response");
    osm=null;
   }catch(error){
    endpointErrors.push(new URL(endpoint).hostname+": "+(error instanceof Error?error.message:"request failed"));
   }
  }
  if(!osm){
   console.error("All Overpass endpoints failed:",endpointErrors);
   return json({error:"Os serviços de localização estão temporariamente indisponíveis. Tentámos vários servidores OpenStreetMap. Aguarda um minuto e tenta novamente."},502);
  }
  const counts=new Map<string,number>();
  for(const el of (Array.isArray(osm?.elements)?osm.elements:[])){const tags=el.tags||{};const raw=tags.brand||tags.operator||tags.name;if(raw){const chain=normalize(String(raw));counts.set(chain,(counts.get(chain)||0)+1);}}
  const chains=[...counts.entries()].map(([chain,nearbyStores])=>({chain,nearbyStores})).sort((a,b)=>b.nearbyStores-a.nearbyStores).slice(0,12);
  if(!chains.length) return json({error:"Não encontrámos supermercados identificáveis num raio de 10 km."},404);
  const prompt=["You estimate a shopping basket cost in Portugal. You do NOT have live catalogue or store prices.","Return JSON with one estimate per supplied chain. Use general known price positioning, quantities and units; never claim current prices were checked.","If you cannot estimate responsibly, mark status insufficient_data. EUR only. confidence low, medium or high. Ensure min <= total <= max. Do not claim guaranteed savings.","Basket: "+JSON.stringify(basket),"Nearby chains and branch counts from OpenStreetMap (not price sources): "+JSON.stringify(chains),"Return {stores:[{chain,nearbyStores,status,estimatedTotal,rangeMin,rangeMax,confidence,notes}]}."].join("\n");
  const ai=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature:0.2,responseSchema:{type:"OBJECT",properties:{stores:{type:"ARRAY",maxItems:12,items:{type:"OBJECT",properties:{chain:{type:"STRING"},nearbyStores:{type:"INTEGER"},status:{type:"STRING",enum:["estimated","insufficient_data"]},estimatedTotal:{type:"NUMBER"},rangeMin:{type:"NUMBER"},rangeMax:{type:"NUMBER"},confidence:{type:"STRING",enum:["low","medium","high"]},notes:{type:"STRING"}},required:["chain","nearbyStores","status","confidence"],propertyOrdering:["chain","nearbyStores","status","estimatedTotal","rangeMin","rangeMax","confidence","notes"]}}},required:["stores"],propertyOrdering:["stores"]}}}),signal:AbortSignal.timeout(45000)});
  const payload=await ai.json().catch(()=>({})); if(!ai.ok) return json({error:payload?.error?.message||"O serviço de estimativa devolveu um erro."},502);
  const raw=payload?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||""; let parsed:any; try{parsed=JSON.parse(raw);}catch{return json({error:"Não foi possível interpretar a estimativa."},502);}
  const known=new Map(chains.map(x=>[x.chain,x.nearbyStores]));
  const stores=(Array.isArray(parsed?.stores)?parsed.stores:[]).map((s:any)=>{
   const chain=String(s?.chain||"").trim(),nearbyStores=known.get(chain); if(!nearbyStores||s.status==="insufficient_data") return {chain,nearbyStores:nearbyStores||0,status:"insufficient_data",confidence:"low"};
   const total=Number(s.estimatedTotal),min=Number(s.rangeMin),max=Number(s.rangeMax);
   if(![total,min,max].every(Number.isFinite)||min<=0||min>total||total>max||max>100000) return {chain,nearbyStores,status:"insufficient_data",confidence:"low"};
   return {chain,nearbyStores,status:"estimated",estimatedTotal:round(total),estimatedRange:{min:round(min),max:round(max)},confidence:["low","medium","high"].includes(s.confidence)?s.confidence:"low",notes:String(s.notes||"").slice(0,180)};
  }).filter((s:any)=>s.chain);
  return json({generatedAt:new Date().toISOString(),currency:"EUR",method:"ai_estimate",radiusKm:10,stores,disclaimer:"Estimativa indicativa gerada por IA. Não corresponde a preços consultados em loja ou em catálogos atuais e pode diferir do valor real.",coverageNote:"As lojas apresentadas dependem dos dados disponíveis no OpenStreetMap e podem não incluir todos os supermercados existentes na zona."});
 }catch(e){console.error("listora-basket-estimate error:",e);return json({error:"Não foi possível estimar o cabaz. Verifica a ligação e tenta novamente."},500);}
});