import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Plan order for validation (lower index = smaller plan) */
const PLAN_ORDER = [
  "transfer_5gb",
  "transfer_20gb",
  "transfer_50gb",
  "transfer_100gb",
];

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
    if (!PLAN_ORDER.includes(newPlanType)) {
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

    // Validate it's actually a downgrade (new plan is lower)
    const currentIdx = PLAN_ORDER.indexOf(currentSub.plan_type);
    const newIdx = PLAN_ORDER.indexOf(newPlanType);

    if (currentIdx < 0 || newIdx < 0 || newIdx >= currentIdx) {
      return new Response(
        JSON.stringify({ error: "New plan must be lower than current plan for downgrade" }),
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
