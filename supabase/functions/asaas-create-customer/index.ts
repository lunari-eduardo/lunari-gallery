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
    const { name, cpfCnpj, email } = await req.json();

    if (!name || !cpfCnpj) {
      return new Response(
        JSON.stringify({ error: "name and cpfCnpj are required" }),
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

    // Check if user already has an Asaas customer ID
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: account } = await adminClient
      .from("photographer_accounts")
      .select("asaas_customer_id")
      .eq("user_id", userId)
      .single();

    if (account?.asaas_customer_id) {
      return new Response(
        JSON.stringify({ customerId: account.asaas_customer_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create customer in Asaas
    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/v3/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify({
        name,
        cpfCnpj: cpfCnpj.replace(/\D/g, ""),
        email: email || undefined,
        externalReference: userId,
      }),
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error("Asaas error:", asaasData);
      const errorMsg =
        asaasData.errors?.[0]?.description || "Failed to create customer";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save customer ID
    await adminClient
      .from("photographer_accounts")
      .update({ asaas_customer_id: asaasData.id })
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({ customerId: asaasData.id }),
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
