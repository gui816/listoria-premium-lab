import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
const cors={ "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return json({error:"Método não permitido."},405);
 try{
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token) return json({error:"Sessão necessária."},401);
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const {data:{user},error}=await auth.auth.getUser(token);
  if(error||!user) return json({error:"Sessão inválida."},401);

  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:sub}=await admin.from("subscriptions").select("plan_key,status,current_period_start,current_period_end,cancel_at_period_end,past_due_grace_until").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  const {data:trial}=await admin.from("premium_comparison_trials").select("used_at").eq("user_id",user.id).maybeSingle();
  const {data:demoSub}=await admin.from("premium_demo_subscriptions").select("status,current_period_start,current_period_end,cancel_at_period_end,past_due_grace_until").eq("user_id",user.id).maybeSingle();
  const now=Date.now();
  const demoGrace=demoSub?.status==="past_due" && demoSub.past_due_grace_until && new Date(demoSub.past_due_grace_until).getTime()>now;
  const demoPaidPeriod=demoSub?.cancel_at_period_end && demoSub.current_period_end && new Date(demoSub.current_period_end).getTime()>now;
  const demoActive=Boolean(demoSub && (demoSub.status==="active" || demoGrace || demoPaidPeriod));
  const grace=sub?.status==="past_due" && sub.past_due_grace_until && new Date(sub.past_due_grace_until).getTime()>now;
  const paidPeriod=sub?.status==="canceled" && sub.current_period_end && new Date(sub.current_period_end).getTime()>now;
  const isPremium=demoActive || Boolean(sub && (["active","trialing"].includes(sub.status)||grace||paidPeriod));
  const activeSubscription=demoActive?{...demoSub,plan_key:"monthly"}:sub;
  const isDemo=Boolean(demoSub);
  return json({isPremium,requiresAccount:user.is_anonymous,isDemo,demoMode:!Deno.env.get("STRIPE_SECRET_KEY"),freeComparisonAvailable:!isPremium&&!trial,freeComparisonUsed:Boolean(trial),subscription:activeSubscription?{plan:activeSubscription.plan_key||"monthly",status:activeSubscription.status,currentPeriodEnd:activeSubscription.current_period_end,cancelAtPeriodEnd:activeSubscription.cancel_at_period_end,graceUntil:activeSubscription.past_due_grace_until}:null});
 }catch(error){console.error("premium-status:",error);return json({error:"Não foi possível consultar a subscrição."},500);}
});
