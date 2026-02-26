import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = Deno.env.get("ASAAS_ENV") === "production"
  ? "https://api.asaas.com"
  : "https://api-sandbox.asaas.com";

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
    const { subscriptionId, action } = await req.json();

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ error: "subscriptionId is required" }),
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

    // Verify ownership
    const { data: sub } = await adminClient
      .from("subscriptions_asaas")
      .select("asaas_subscription_id, status")
      .eq("id", subscriptionId)
      .eq("user_id", userId)
      .single();

    if (!sub) {
      return new Response(
        JSON.stringify({ error: "Subscription not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reactivate flow
    if (action === "reactivate") {
      if (sub.status !== "CANCELLED") {
        return new Response(
          JSON.stringify({ error: "Subscription is not cancelled" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try to reactivate in Asaas (undoing the deletion)
      // Asaas doesn't support un-deleting, so we just update local status
      // The subscription will continue billing if Asaas hasn't fully removed it
      if (sub.asaas_subscription_id) {
        try {
          const asaasResponse = await fetch(
            `${ASAAS_BASE_URL}/v3/subscriptions/${sub.asaas_subscription_id}`,
            {
              method: "GET",
              headers: { access_token: ASAAS_API_KEY },
            }
          );
          if (asaasResponse.ok) {
            const asaasSub = await asaasResponse.json();
            // If Asaas still has it as active/pending, we can reactivate locally
            if (asaasSub.status === "ACTIVE" || asaasSub.deleted === false) {
              console.log("Asaas subscription still active, reactivating locally");
            }
          }
        } catch (e) {
          console.error("Error checking Asaas subscription status:", e);
        }
      }

      await adminClient
        .from("subscriptions_asaas")
        .update({ status: "ACTIVE" })
        .eq("id", subscriptionId);

      return new Response(
        JSON.stringify({ success: true, action: "reactivated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cancel flow
    if (sub.asaas_subscription_id) {
      const asaasResponse = await fetch(
        `${ASAAS_BASE_URL}/v3/subscriptions/${sub.asaas_subscription_id}`,
        {
          method: "DELETE",
          headers: { access_token: ASAAS_API_KEY },
        }
      );

      if (!asaasResponse.ok) {
        const errorData = await asaasResponse.json();
        console.error("Asaas cancel error:", errorData);
        // Still update locally even if Asaas fails
      }
    }

    // Update local status — preserve next_due_date for active period tracking
    await adminClient
      .from("subscriptions_asaas")
      .update({ status: "CANCELLED" })
      .eq("id", subscriptionId);

    return new Response(
      JSON.stringify({ success: true }),
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
