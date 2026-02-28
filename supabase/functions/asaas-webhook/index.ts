import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GB = 1024 * 1024 * 1024;
const STORAGE_LIMITS: Record<string, number> = {
  transfer_5gb: 5 * GB,
  transfer_20gb: 20 * GB,
  transfer_50gb: 50 * GB,
  transfer_100gb: 100 * GB,
  combo_completo: 20 * GB,
};

// Plans that grant subscription credits per cycle
const PLAN_SUBSCRIPTION_CREDITS: Record<string, number> = {
  combo_pro_select2k: 2000,
  combo_completo: 2000,
};

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  // Studio
  studio_starter: { monthly: 1490, yearly: 15198 },
  studio_pro: { monthly: 3590, yearly: 36618 },
  // Transfer
  transfer_5gb: { monthly: 1290, yearly: 12384 },
  transfer_20gb: { monthly: 2490, yearly: 23904 },
  transfer_50gb: { monthly: 3490, yearly: 33504 },
  transfer_100gb: { monthly: 5990, yearly: 57504 },
  // Combos
  combo_pro_select2k: { monthly: 4490, yearly: 45259 },
  combo_completo: { monthly: 6490, yearly: 66198 },
};

const ASAAS_BASE_URL = Deno.env.get("ASAAS_ENV") === "production"
  ? "https://api.asaas.com"
  : "https://api-sandbox.asaas.com";

async function applyDowngrade(adminClient: any, subscription: any) {
  const newPlanType = subscription.pending_downgrade_plan;
  const newCycle = subscription.pending_downgrade_cycle || subscription.billing_cycle;

  if (!newPlanType) return;

  console.log(`Applying scheduled downgrade: ${subscription.plan_type} → ${newPlanType}`);

  const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
  if (!ASAAS_API_KEY) {
    console.error("ASAAS_API_KEY not configured, cannot apply downgrade");
    return;
  }

  const userId = subscription.user_id;

  // 1. Cancel old subscription in Asaas
  if (subscription.asaas_subscription_id) {
    const cancelRes = await fetch(
      `${ASAAS_BASE_URL}/v3/subscriptions/${subscription.asaas_subscription_id}`,
      { method: "DELETE", headers: { access_token: ASAAS_API_KEY } }
    );
    if (!cancelRes.ok) {
      console.error("Failed to cancel old subscription in Asaas:", await cancelRes.text());
    }
  }

  // 2. Mark old subscription as CANCELLED and clear pending
  await adminClient
    .from("subscriptions_asaas")
    .update({
      status: "CANCELLED",
      pending_downgrade_plan: null,
      pending_downgrade_cycle: null,
    })
    .eq("id", subscription.id);

  // 3. Get customer ID
  const { data: account } = await adminClient
    .from("photographer_accounts")
    .select("asaas_customer_id")
    .eq("user_id", userId)
    .single();

  if (!account?.asaas_customer_id) {
    console.error("No customer ID found for user:", userId);
    return;
  }

  // 4. Create new subscription in Asaas with downgraded plan
  const newPrices = PLAN_PRICES[newPlanType];
  if (!newPrices) {
    console.error("Unknown plan type for pricing:", newPlanType);
    return;
  }
  const newValueCents = newCycle === "YEARLY" ? newPrices.yearly : newPrices.monthly;
  const newValueReais = newValueCents / 100;

  // Use creditCardToken from old subscription metadata for auto-renewal
  const creditCardToken = subscription.metadata?.creditCardToken;

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + (newCycle === "YEARLY" ? 365 : 30));
  const nextDueDateStr = nextDueDate.toISOString().split("T")[0];

  const newSubPayload: Record<string, unknown> = {
    customer: account.asaas_customer_id,
    billingType: "CREDIT_CARD",
    cycle: newCycle,
    value: newValueReais,
    nextDueDate: nextDueDateStr,
    description: `Transfer ${newPlanType.replace("transfer_", "").toUpperCase()} - ${newCycle === "YEARLY" ? "Anual" : "Mensal"}`,
    externalReference: userId,
  };

  if (creditCardToken) {
    newSubPayload.creditCardToken = creditCardToken;
  }

  const newSubRes = await fetch(`${ASAAS_BASE_URL}/v3/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
    body: JSON.stringify(newSubPayload),
  });

  const newSubData = await newSubRes.json();
  if (!newSubRes.ok) {
    console.error("Failed to create downgraded subscription:", newSubData);
    return;
  }

  // 5. Insert new subscription in DB
  await adminClient.from("subscriptions_asaas").insert({
    user_id: userId,
    asaas_customer_id: account.asaas_customer_id,
    asaas_subscription_id: newSubData.id,
    plan_type: newPlanType,
    billing_cycle: newCycle,
    status: newSubData.status || "ACTIVE",
    value_cents: newValueCents,
    next_due_date: newSubData.nextDueDate || nextDueDateStr,
    metadata: {
      creditCardToken: newSubData.creditCard?.creditCardToken || creditCardToken,
      downgraded_from: subscription.plan_type,
    },
  });

  // 6. Check if storage exceeds new limit → activate over-limit mode
  const newLimit = STORAGE_LIMITS[newPlanType] || 0;

  const { data: storageData } = await adminClient.rpc("get_transfer_storage_bytes", {
    _user_id: userId,
  });
  const storageUsed = (storageData as number) || 0;

  if (storageUsed > newLimit) {
    console.log(`OVER LIMIT: ${storageUsed} bytes used, limit is ${newLimit} bytes. Activating over-limit mode.`);

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    // Set account over-limit flags
    await adminClient
      .from("photographer_accounts")
      .update({
        account_over_limit: true,
        over_limit_since: new Date().toISOString(),
        deletion_scheduled_at: deletionDate.toISOString(),
      })
      .eq("user_id", userId);

    // Expire all active Transfer galleries
    await adminClient
      .from("galerias")
      .update({ status: "expired_due_to_plan" })
      .eq("user_id", userId)
      .eq("tipo", "entrega")
      .in("status", ["enviado", "rascunho"]);

    console.log(`All Transfer galleries expired. Deletion scheduled for ${deletionDate.toISOString()}`);
  } else {
    console.log(`Storage OK: ${storageUsed} bytes used, limit is ${newLimit} bytes.`);
  }

  console.log(`Downgrade complete: new subscription ${newSubData.id}, plan ${newPlanType}`);
}

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

        // Check for pending downgrade
        const { data: sub } = await adminClient
          .from("subscriptions_asaas")
          .select("*")
          .eq("asaas_subscription_id", payment.subscription)
          .single();

        if (sub?.pending_downgrade_plan) {
          await applyDowngrade(adminClient, sub);
        }
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
        console.log("Payment refunded/deleted for subscription:", payment.subscription);
      }
    }

    // Handle subscription events
    if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      const subId = subscription?.id || body.id;
      if (subId) {
        // Get subscription before updating status to know the plan
        const { data: sub } = await adminClient
          .from("subscriptions_asaas")
          .select("*")
          .eq("asaas_subscription_id", subId)
          .single();

        await adminClient
          .from("subscriptions_asaas")
          .update({ status: "CANCELLED" })
          .eq("asaas_subscription_id", subId);

        console.log("Subscription cancelled:", subId);

        // Expire subscription credits if plan included them
        if (sub) {
          const subCredits = PLAN_SUBSCRIPTION_CREDITS[sub.plan_type];
          if (subCredits && subCredits > 0) {
            const { error: expireError } = await adminClient.rpc("expire_subscription_credits", {
              _user_id: sub.user_id,
            });
            if (expireError) {
              console.error("Failed to expire subscription credits:", expireError);
            } else {
              console.log(`Expired subscription credits for user ${sub.user_id}`);
            }
          }
        }
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

        const { data: sub } = await adminClient
          .from("subscriptions_asaas")
          .select("*")
          .eq("asaas_subscription_id", subId)
          .single();

        if (sub) {
          // Renew subscription credits if plan includes them
          const subCredits = PLAN_SUBSCRIPTION_CREDITS[sub.plan_type];
          if (subCredits && subCredits > 0) {
            const { error: creditError } = await adminClient.rpc("renew_subscription_credits", {
              _user_id: sub.user_id,
              _amount: subCredits,
            });
            if (creditError) {
              console.error("Failed to renew subscription credits:", creditError);
            } else {
              console.log(`Renewed ${subCredits} subscription credits for user ${sub.user_id}`);
            }
          }

          // Check for pending downgrade on renewal
          if (sub.pending_downgrade_plan) {
            await applyDowngrade(adminClient, sub);
          }
        }
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
