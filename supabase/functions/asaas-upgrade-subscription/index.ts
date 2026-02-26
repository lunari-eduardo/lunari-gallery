import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = Deno.env.get("ASAAS_ENV") === "production"
  ? "https://api.asaas.com"
  : "https://api-sandbox.asaas.com";

const PLANS: Record<string, { monthlyPrice: number; yearlyPrice: number; name: string }> = {
  studio_starter: { monthlyPrice: 1490, yearlyPrice: 15198, name: "Lunari Starter" },
  studio_pro: { monthlyPrice: 3590, yearlyPrice: 36618, name: "Lunari Pro" },
  transfer_5gb: { monthlyPrice: 1290, yearlyPrice: 12384, name: "Transfer 5GB" },
  transfer_20gb: { monthlyPrice: 2490, yearlyPrice: 23904, name: "Transfer 20GB" },
  transfer_50gb: { monthlyPrice: 3490, yearlyPrice: 33504, name: "Transfer 50GB" },
  transfer_100gb: { monthlyPrice: 5990, yearlyPrice: 57504, name: "Transfer 100GB" },
  combo_pro_select2k: { monthlyPrice: 4490, yearlyPrice: 45259, name: "Studio Pro + Select 2k" },
  combo_completo: { monthlyPrice: 6490, yearlyPrice: 66198, name: "Combo Completo" },
};

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / msPerDay));
}

function getNextBusinessDay(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const day = date.getDay();
  if (day === 0) date.setDate(date.getDate() + 1);
  if (day === 6) date.setDate(date.getDate() + 2);
  return date.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = await req.json();
    const {
      currentSubscriptionId, // single (backwards compat)
      subscriptionIdsToCancel, // array (cross-product)
      newPlanType,
      billingCycle,
      creditCard,
      creditCardHolderInfo,
      remoteIp,
    } = body;

    // Build list of subscription IDs to cancel
    const idsToCancel: string[] = subscriptionIdsToCancel
      ? subscriptionIdsToCancel
      : currentSubscriptionId
        ? [currentSubscriptionId]
        : [];

    if (idsToCancel.length === 0 || !newPlanType || !billingCycle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newPlan = PLANS[newPlanType];
    if (!newPlan) {
      return new Response(
        JSON.stringify({ error: "Invalid plan type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ASAAS_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch all subscriptions to cancel and calculate combined prorata
    let totalProrataValueCents = 0;
    let latestNextDueDate: string | null = null;
    const cancelledNames: string[] = [];

    for (const subId of idsToCancel) {
      const { data: currentSub } = await adminClient
        .from("subscriptions_asaas")
        .select("*")
        .eq("id", subId)
        .eq("user_id", userId)
        .single();

      if (!currentSub) {
        console.warn(`Subscription ${subId} not found, skipping`);
        continue;
      }

      const currentPlan = PLANS[currentSub.plan_type];
      const currentPriceCents = currentSub.billing_cycle === "YEARLY"
        ? (currentPlan?.yearlyPrice || currentSub.value_cents)
        : (currentPlan?.monthlyPrice || currentSub.value_cents);

      const today = new Date();
      const nextDue = currentSub.next_due_date ? new Date(currentSub.next_due_date) : today;
      const daysRemaining = daysBetween(today, nextDue);
      const totalCycleDays = currentSub.billing_cycle === "YEARLY" ? 365 : 30;

      // Prorata = unused portion of current plan
      const unusedValueCents = Math.max(0, Math.round(currentPriceCents * (daysRemaining / totalCycleDays)));
      totalProrataValueCents += unusedValueCents;

      // Track latest next_due_date for the new subscription
      if (!latestNextDueDate || (currentSub.next_due_date && currentSub.next_due_date > latestNextDueDate)) {
        latestNextDueDate = currentSub.next_due_date;
      }

      cancelledNames.push(currentPlan?.name || currentSub.plan_type);

      // Cancel in Asaas
      if (currentSub.asaas_subscription_id) {
        const cancelRes = await fetch(
          `${ASAAS_BASE_URL}/v3/subscriptions/${currentSub.asaas_subscription_id}`,
          { method: "DELETE", headers: { access_token: ASAAS_API_KEY } }
        );
        if (!cancelRes.ok) {
          console.error(`Failed to cancel subscription ${currentSub.asaas_subscription_id} in Asaas:`, await cancelRes.text());
        }
      }

      // Mark as CANCELLED in DB
      await adminClient
        .from("subscriptions_asaas")
        .update({ status: "CANCELLED" })
        .eq("id", subId);

      console.log(`Cancelled subscription ${subId} (${currentSub.plan_type}), unused value: ${unusedValueCents} cents`);
    }

    // 2. Calculate net charge: new plan price - combined prorata credit
    const newPriceCents = billingCycle === "YEARLY" ? newPlan.yearlyPrice : newPlan.monthlyPrice;
    const netChargeCents = Math.max(0, newPriceCents - totalProrataValueCents);
    const netChargeReais = netChargeCents / 100;

    console.log(`Cross-product upgrade: [${cancelledNames.join(', ')}] → ${newPlanType}, prorata credit: ${totalProrataValueCents} cents, net charge: ${netChargeCents} cents`);

    // Get customer ID
    const { data: account } = await adminClient
      .from("photographer_accounts")
      .select("asaas_customer_id")
      .eq("user_id", userId)
      .single();

    if (!account?.asaas_customer_id) {
      return new Response(
        JSON.stringify({ error: "Customer not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Charge net amount as one-time payment (if > 0)
    let prorataPaymentId: string | null = null;
    if (netChargeCents > 0) {
      const paymentPayload: Record<string, unknown> = {
        customer: account.asaas_customer_id,
        billingType: "CREDIT_CARD",
        value: netChargeReais,
        dueDate: getNextBusinessDay(),
        description: `Upgrade: ${cancelledNames.join(' + ')} → ${newPlan.name} (proporcional)`,
        externalReference: userId,
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.number.replace(/\s/g, ""),
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo.name,
          email: creditCardHolderInfo.email || user.email,
          cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ""),
          postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ""),
          addressNumber: creditCardHolderInfo.addressNumber || "S/N",
          phone: creditCardHolderInfo.phone.replace(/\D/g, ""),
        },
      };
      if (remoteIp) paymentPayload.remoteIp = remoteIp;

      const payRes = await fetch(`${ASAAS_BASE_URL}/v3/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
        body: JSON.stringify(paymentPayload),
      });

      const payData = await payRes.json();
      if (!payRes.ok) {
        console.error("Prorata payment error:", payData);
        const errMsg = payData.errors?.[0]?.description || "Falha ao cobrar valor proporcional";
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      prorataPaymentId = payData.id;
      console.log("Prorata payment created:", payData.id, "status:", payData.status);
    }

    // 4. Create new subscription in Asaas
    const newValueReais = newPriceCents / 100;
    const newSubPayload: Record<string, unknown> = {
      customer: account.asaas_customer_id,
      billingType: "CREDIT_CARD",
      cycle: billingCycle,
      value: newValueReais,
      nextDueDate: latestNextDueDate || getNextBusinessDay(),
      description: `${newPlan.name} - ${billingCycle === "YEARLY" ? "Anual" : "Mensal"}`,
      externalReference: userId,
      creditCard: {
        holderName: creditCard.holderName,
        number: creditCard.number.replace(/\s/g, ""),
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv,
      },
      creditCardHolderInfo: {
        name: creditCardHolderInfo.name,
        email: creditCardHolderInfo.email || user.email,
        cpfCnpj: creditCardHolderInfo.cpfCnpj.replace(/\D/g, ""),
        postalCode: creditCardHolderInfo.postalCode.replace(/\D/g, ""),
        addressNumber: creditCardHolderInfo.addressNumber || "S/N",
        phone: creditCardHolderInfo.phone.replace(/\D/g, ""),
      },
    };
    if (remoteIp) newSubPayload.remoteIp = remoteIp;

    const newSubRes = await fetch(`${ASAAS_BASE_URL}/v3/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
      body: JSON.stringify(newSubPayload),
    });

    const newSubData = await newSubRes.json();
    if (!newSubRes.ok) {
      console.error("New subscription error:", newSubData);
      const errMsg = newSubData.errors?.[0]?.description || "Falha ao criar nova assinatura";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creditCardToken = newSubData.creditCard?.creditCardToken || null;

    // 5. Insert new subscription in DB
    const { data: newSub } = await adminClient
      .from("subscriptions_asaas")
      .insert({
        user_id: userId,
        asaas_customer_id: account.asaas_customer_id,
        asaas_subscription_id: newSubData.id,
        plan_type: newPlanType,
        billing_cycle: billingCycle,
        status: newSubData.status || "ACTIVE",
        value_cents: newPriceCents,
        next_due_date: newSubData.nextDueDate,
        metadata: {
          creditCardToken,
          creditCardBrand: newSubData.creditCard?.creditCardBrand || null,
          creditCardNumber: newSubData.creditCard?.creditCardNumber || null,
          upgraded_from: cancelledNames,
          prorata_payment_id: prorataPaymentId,
          prorata_credit_cents: totalProrataValueCents,
          net_charge_cents: netChargeCents,
        },
      })
      .select()
      .single();

    console.log("Upgrade complete:", newSubData.id);

    // 6. Clear over-limit mode
    await adminClient
      .from("photographer_accounts")
      .update({
        account_over_limit: false,
        over_limit_since: null,
        deletion_scheduled_at: null,
      })
      .eq("user_id", userId);

    // 7. Reactivate expired galleries
    const newStorageLimit: Record<string, number> = {
      transfer_5gb: 5 * 1024 * 1024 * 1024,
      transfer_20gb: 20 * 1024 * 1024 * 1024,
      transfer_50gb: 50 * 1024 * 1024 * 1024,
      transfer_100gb: 100 * 1024 * 1024 * 1024,
      combo_completo: 20 * 1024 * 1024 * 1024,
    };

    if ((newStorageLimit[newPlanType] || 0) > 0) {
      await adminClient
        .from("galerias")
        .update({ status: "enviado" })
        .eq("user_id", userId)
        .eq("tipo", "entrega")
        .eq("status", "expired_due_to_plan");

      console.log("Reactivated expired_due_to_plan galleries for user:", userId);
    }

    return new Response(
      JSON.stringify({
        newSubscriptionId: newSubData.id,
        status: newSubData.status || "ACTIVE",
        prorataPaymentId,
        prorataValueCents: totalProrataValueCents,
        netChargeCents,
        localId: newSub?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
