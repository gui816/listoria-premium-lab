import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const cors={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Método não permitido."},405);
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return json({error:"Inicia sessão para continuar."},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:{user},error}=await auth.auth.getUser(token);
  if(error||!user)return json({error:"Sessão inválida."},401);
  if(user.is_anonymous)return json({error:"Cria uma conta para gerir a demonstração Premium."},403);
  if(Deno.env.get("STRIPE_SECRET_KEY"))return json({error:"O modo de demonstração está desativado porque o Stripe está configurado."},409);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"");
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:current}=await admin.from("premium_demo_subscriptions").select("*").eq("user_id",user.id).maybeSingle();
  if(!current)return json({error:"Não existe uma subscrição de demonstração ativa."},404);
  const now=new Date();
  let update:any={};
  if(action==="cancel"){
    update={cancel_at_period_end:true};
  }else if(action==="reactivate"){
    update={status:"active",cancel_at_period_end:false,past_due_grace_until:null};
  }else if(action==="simulate_payment_failure"){
    update={status:"past_due",cancel_at_period_end:false,past_due_grace_until:new Date(now.getTime()+3*24*60*60*1000).toISOString()};
  }else if(action==="resolve_payment"){
    update={status:"active",cancel_at_period_end:false,past_due_grace_until:null};
  }else if(action==="expire"){
    update={status:"unpaid",cancel_at_period_end:false,past_due_grace_until:null,current_period_end:now.toISOString()};
  }else if(action==="renew"){
    update={status:"active",current_period_start:now.toISOString(),current_period_end:new Date(now.getTime()+30*24*60*60*1000).toISOString(),cancel_at_period_end:false,past_due_grace_until:null};
  }else return json({error:"Ação de demonstração inválida."},400);
  const {data:updated,error:updateError}=await admin.from("premium_demo_subscriptions").update(update).eq("user_id",user.id).select("*").single();
  if(updateError)throw updateError;
  return json({demo:true,subscription:updated});
 }catch(error){console.error("premium-demo-manage:",error);return json({error:"Não foi possível atualizar a subscrição de demonstração."},500);}
});