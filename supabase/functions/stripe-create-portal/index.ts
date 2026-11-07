import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return json({error:"Método não permitido."},405);
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token) return json({error:"Inicia sessão para continuar."},401);
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, key=Deno.env.get("STRIPE_SECRET_KEY"), appUrl=Deno.env.get("APP_URL");
  if(!url||!anon||!service) return json({error:"A configuração da aplicação está incompleta."},503);
  const auth=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:{user},error}=await auth.auth.getUser(token);
  if(error||!user) return json({error:"Sessão inválida."},401);
  if(user.is_anonymous) return json({error:"Cria uma conta para gerir o Premium."},403);
  if(!key) return json({demo:true,manageInApp:true});
  if(!appUrl) return json({error:"APP_URL não está configurado."},503);
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:sub}=await admin.from("subscriptions").select("stripe_customer_id").eq("user_id",user.id).not("stripe_customer_id","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(!sub?.stripe_customer_id) return json({error:"Não encontrámos uma conta Stripe associada."},404);
  const stripe=new Stripe(key,{apiVersion:"2025-02-24.acacia"});
  const session=await stripe.billingPortal.sessions.create({customer:sub.stripe_customer_id,return_url:appUrl});
  return json({url:session.url});
 }catch(error){console.error("stripe-create-portal:",error);return json({error:"Não foi possível abrir a gestão da subscrição."},500);}
});
