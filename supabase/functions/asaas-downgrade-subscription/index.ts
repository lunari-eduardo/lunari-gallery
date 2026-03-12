import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Plan prices in cents for downgrade validation — ALL plan families. */
const ALL_PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  studio_starter: { monthly: 1490, yearly: 15198 },
  studio_pro: { monthly: 3590, yearly: 36618 },
  transfer_5gb: { monthly: 1290, yearly: 12384 },
  transfer_20gb: { monthly: 2490, yearly: 23904 },
  transfer_50gb: { monthly: 3490, yearly: 33504 },
  transfer_100gb: { monthly: 5990, yearly: 57504 },
  combo_pro_select2k: { monthly: 4490, yearly: 45259 },
  combo_completo: { monthly: 6490, yearly: 66198 },
};

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

    const { subscriptionId, newPlanType, newBillingCycle } = await req.json();

    if (!subscriptionId || !newPlanType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: subscriptionId, newPlanType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate plan exists
    if (!ALL_PLAN_PRICES[newPlanType]) {
      return new Response(
        JSON.stringify({ error: "Invalid plan type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch current subscription
    const { data: currentSub, error: subError } = await adminClient
      .from("subscriptions_asaas")
      .select("*")
      .eq("id", subscriptionId)
      .eq("user_id", user.id)
      .in("status", ["ACTIVE", "PENDING", "OVERDUE"])
      .single();

    if (subError || !currentSub) {
      return new Response(
        JSON.stringify({ error: "Active subscription not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate it's actually a downgrade (new plan is cheaper)
    const currentPrices = ALL_PLAN_PRICES[currentSub.plan_type];
    const newPrices = ALL_PLAN_PRICES[newPlanType];

    if (!currentPrices || !newPrices) {
      return new Response(
        JSON.stringify({ error: "Cannot determine pricing for plan comparison" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentMonthly = currentPrices.monthly;
    const newMonthly = newPrices.monthly;

    if (newMonthly >= currentMonthly) {
      return new Response(
        JSON.stringify({ error: "New plan must be cheaper than current plan for downgrade" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save pending downgrade
    const { error: updateError } = await adminClient
      .from("subscriptions_asaas")
      .update({
        pending_downgrade_plan: newPlanType,
        pending_downgrade_cycle: newBillingCycle || currentSub.billing_cycle,
      })
      .eq("id", subscriptionId);

    if (updateError) {
      console.error("Error scheduling downgrade:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to schedule downgrade" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Downgrade scheduled: ${currentSub.plan_type} → ${newPlanType} for subscription ${subscriptionId}`);

    // Recalculate referral transfer bonus for the new (downgraded) plan
    const GB = 1024 * 1024 * 1024;
    const DOWNGRADE_STORAGE: Record<string, number> = {
      transfer_5gb: 5 * GB, transfer_20gb: 20 * GB,
      transfer_50gb: 50 * GB, transfer_100gb: 100 * GB,
      combo_completo: 20 * GB,
    };
    const newStorageBytes = DOWNGRADE_STORAGE[newPlanType] || 0;
    if (newStorageBytes > 0) {
      try {
        const { data: recalcResult, error: recalcErr } = await adminClient.rpc('recalculate_referral_transfer_bonus', {
          _referred_user_id: user.id,
          _new_plan_storage_bytes: newStorageBytes,
        });
        if (recalcErr) {
          console.warn('Referral recalculate error (non-fatal):', recalcErr.message);
        } else if (recalcResult) {
          console.log('🎁 Referral Transfer bonus recalculated for downgrade to', newPlanType);
        }
      } catch (e) {
        console.warn('Referral recalculate exception (non-fatal):', e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        currentPlan: currentSub.plan_type,
        scheduledPlan: newPlanType,
        scheduledCycle: newBillingCycle || currentSub.billing_cycle,
        message: "Downgrade agendado para o próximo ciclo de cobrança.",
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
