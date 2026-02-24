import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const event = body.event;
    const payment = body.payment;
    const subscription = body.subscription;

    console.log("Asaas webhook received:", event, JSON.stringify(body).slice(0, 500));

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Log webhook
    await adminClient.from("webhook_logs").insert({
      provider: "asaas",
      event_type: event,
      payload: body,
      headers: Object.fromEntries(req.headers.entries()),
    }).then(() => {}, (err) => console.error("Log insert error:", err));

    // Handle payment events
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      if (payment?.subscription) {
        await adminClient
          .from("subscriptions_asaas")
          .update({
            status: "ACTIVE",
            next_due_date: payment.dueDate,
          })
          .eq("asaas_subscription_id", payment.subscription);

        console.log("Subscription activated:", payment.subscription);
      }
    }

    if (event === "PAYMENT_OVERDUE") {
      if (payment?.subscription) {
        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "OVERDUE" })
          .eq("asaas_subscription_id", payment.subscription);

        console.log("Subscription overdue:", payment.subscription);
      }
    }

    if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_DELETED") {
      if (payment?.subscription) {
        // Check if there are other confirmed payments
        console.log("Payment refunded/deleted for subscription:", payment.subscription);
      }
    }

    // Handle subscription events
    if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      const subId = subscription?.id || body.id;
      if (subId) {
        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "CANCELLED" })
          .eq("asaas_subscription_id", subId);

        console.log("Subscription cancelled:", subId);
      }
    }

    if (event === "SUBSCRIPTION_RENEWED") {
      const subId = subscription?.id || body.id;
      if (subId) {
        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "ACTIVE" })
          .eq("asaas_subscription_id", subId);

        console.log("Subscription renewed:", subId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
