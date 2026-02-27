import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = Deno.env.get("ASAAS_ENV") === "production"
  ? "https://api.asaas.com"
  : "https://api-sandbox.asaas.com";

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized", requestId }), {
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
      return new Response(JSON.stringify({ error: "Unauthorized", requestId }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { name, cpfCnpj, email, forceRecreate } = await req.json();

    console.log(`[${requestId}] asaas-create-customer: userId=${userId}, forceRecreate=${!!forceRecreate}`);

    if (!name || !cpfCnpj) {
      return new Response(
        JSON.stringify({ error: "name and cpfCnpj are required", requestId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ASAAS_API_KEY not configured", requestId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: account } = await adminClient
      .from("photographer_accounts")
      .select("asaas_customer_id")
      .eq("user_id", userId)
      .single();

    // If customer already exists and not forcing recreate, validate it exists in Asaas
    if (account?.asaas_customer_id && !forceRecreate) {
      // Quick validation: check if the customer exists in Asaas
      const checkResponse = await fetch(
        `${ASAAS_BASE_URL}/v3/customers/${account.asaas_customer_id}`,
        {
          headers: { access_token: ASAAS_API_KEY },
        }
      );

      if (checkResponse.ok) {
        console.log(`[${requestId}] Existing customer validated: ${account.asaas_customer_id}`);
        return new Response(
          JSON.stringify({ customerId: account.asaas_customer_id, requestId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Customer doesn't exist in Asaas (probably from different environment), clear and recreate
      console.warn(`[${requestId}] Stored customer ${account.asaas_customer_id} not found in Asaas (env mismatch?). Recreating...`);
      await adminClient
        .from("photographer_accounts")
        .update({ asaas_customer_id: null })
        .eq("user_id", userId);
    }

    // Create customer in Asaas
    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, "");
    console.log(`[${requestId}] Creating customer in Asaas: cpfCnpj length=${cleanCpfCnpj.length}`);

    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/v3/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify({
        name,
        cpfCnpj: cleanCpfCnpj,
        email: email || undefined,
        externalReference: userId,
      }),
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) {
      const errorMsg =
        asaasData.errors?.[0]?.description || "Failed to create customer";
      console.error(`[${requestId}] Asaas customer creation error:`, JSON.stringify(asaasData.errors || asaasData));
      return new Response(JSON.stringify({ error: errorMsg, requestId }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save customer ID
    await adminClient
      .from("photographer_accounts")
      .update({ asaas_customer_id: asaasData.id })
      .eq("user_id", userId);

    console.log(`[${requestId}] Customer created: ${asaasData.id}`);

    return new Response(
      JSON.stringify({ customerId: asaasData.id, requestId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error.message, requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
