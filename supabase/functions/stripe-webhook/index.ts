import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const planFromPrice=(price:any)=>price?.recurring?.interval==="month"&&Number(price?.recurring?.interval_count||1)===1?"monthly":null;
serve(async(req)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const signature=req.headers.get("stripe-signature");
 const secret=Deno.env.get("STRIPE_WEBHOOK_SECRET"), stripeKey=Deno.env.get("STRIPE_SECRET_KEY");
 const url=Deno.env.get("SUPABASE_URL"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!signature||!secret||!stripeKey||!url||!service)return json({error:"Webhook configuration missing"},503);
 const payload=await req.text();
 const stripe=new Stripe(stripeKey,{apiVersion:"2025-02-24.acacia"});
 let event:Stripe.Event;
 try{
  event=await stripe.webhooks.constructEventAsync(payload,signature,secret,undefined,Stripe.createSubtleCryptoProvider());
 }catch(error){console.error("Invalid Stripe signature:",error);return json({error:"Invalid signature"},400);}
 const admin=createClient(url,service,{auth:{persistSession:false}});
 let eventRowId:string|undefined;
 const {data:inserted,error:insertError}=await admin.from("subscription_events").insert({
  stripe_event_id:event.id,event_type:event.type,payload:event as unknown as Record<string,unknown>
 }).select("id").maybeSingle();
 if(insertError?.code==="23505"){
  const {data:existing}=await admin.from("subscription_events").select("id,processed_at").eq("stripe_event_id",event.id).maybeSingle();
  if(existing?.processed_at)return json({received:true,duplicate:true});
  eventRowId=existing?.id;
 }else if(insertError)return json({error:"Could not record event"},500);
 else eventRowId=inserted?.id;
 try{
  const syncSubscription=async(subscription:Stripe.Subscription, customerId:string|null=null)=>{
   const metadata=subscription.metadata||{};
   const userId=metadata.supabase_user_id;
   if(!userId)throw new Error("Subscription metadata is missing supabase_user_id");
   const firstItem=subscription.items.data[0];
   const priceId=firstItem?.price?.id||null;
   const planKey=planFromPrice(firstItem?.price);
   if(!planKey|| (metadata.plan_key && metadata.plan_key!=="monthly")) {
    throw new Error("Stripe subscription does not use the supported monthly Premium price");
   }
   const {data:previous}=await admin.from("subscriptions").select("past_due_since,past_due_grace_until").eq("stripe_subscription_id",subscription.id).maybeSingle();
   const isPastDue=subscription.status==="past_due";
   const pastDueSince=isPastDue?(previous?.past_due_since||new Date().toISOString()):null;
   const graceUntil=isPastDue?(previous?.past_due_grace_until||new Date(Date.now()+3*24*60*60*1000).toISOString()):null;
   const periodStart=firstItem?.current_period_start||null;
   const periodEnd=firstItem?.current_period_end||null;
   const record={
    user_id:userId,
    stripe_customer_id:customerId|| (typeof subscription.customer==="string"?subscription.customer:null),
    stripe_subscription_id:subscription.id,
    stripe_price_id:priceId,
    plan_key:planKey,
    status:subscription.status,
    current_period_start:periodStart?new Date(periodStart*1000).toISOString():null,
    current_period_end:periodEnd?new Date(periodEnd*1000).toISOString():null,
    cancel_at_period_end:subscription.cancel_at_period_end,
    canceled_at:subscription.canceled_at?new Date(subscription.canceled_at*1000).toISOString():null,
    past_due_since:pastDueSince,
    past_due_grace_until:graceUntil
   };
   const {error}=await admin.from("subscriptions").upsert(record,{onConflict:"stripe_subscription_id"});
   if(error)throw error;
   return userId;
  };
  if(event.type==="checkout.session.completed"){
   const session=event.data.object as Stripe.Checkout.Session;
   if(session.mode==="subscription"&&session.subscription){
    const subscription=await stripe.subscriptions.retrieve(String(session.subscription));
    await syncSubscription(subscription,typeof session.customer==="string"?session.customer:null);
   }
  }else if(event.type.startsWith("customer.subscription.")){
   await syncSubscription(event.data.object as Stripe.Subscription);
  }else if(event.type==="invoice.payment_failed"||event.type==="invoice.paid"){
   const invoice=event.data.object as Stripe.Invoice;
   const subscriptionId=typeof (invoice as any).subscription==="string"?(invoice as any).subscription:(invoice as any).subscription?.id;
   if(subscriptionId){
    const subscription=await stripe.subscriptions.retrieve(subscriptionId);
    const userId=await syncSubscription(subscription);
    if(event.type==="invoice.paid" && userId && invoice.status==="paid"){
     // Count only the first real Stripe invoice payment; demo subscriptions never reach this webhook.
     const {error: conversionError}=await admin.from("premium_paid_conversions").upsert({
      user_id:userId,
      first_paid_at:invoice.status_transitions?.paid_at?new Date(invoice.status_transitions.paid_at*1000).toISOString():new Date().toISOString(),
      stripe_subscription_id:subscriptionId,
      stripe_invoice_id:invoice.id,
      amount_paid:invoice.amount_paid,
      currency:invoice.currency
     },{onConflict:"user_id",ignoreDuplicates:true});
     if(conversionError)throw conversionError;
    }
    if(event.type==="invoice.payment_failed"){
     await admin.from("subscriptions").update({last_payment_error:"payment_failed"}).eq("stripe_subscription_id",subscriptionId);
    }else{
     await admin.from("subscriptions").update({last_payment_error:null,past_due_since:null,past_due_grace_until:null}).eq("stripe_subscription_id",subscriptionId);
    }
   }
  }
  await admin.from("subscription_events").update({processed_at:new Date().toISOString()}).eq("id",eventRowId);
  return json({received:true});
 }catch(error){
  console.error("Stripe webhook processing failed:",error);
  await admin.from("subscription_events").update({processing_error:String(error).slice(0,1000)}).eq("id",eventRowId);
  return json({error:"Webhook processing failed"},500);
 }
});
