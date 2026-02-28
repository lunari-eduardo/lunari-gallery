import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = Deno.env.get("ASAAS_ENV") === "production"
  ? "https://api.asaas.com"
  : "https://api-sandbox.asaas.com";

// Plan pricing in cents
const PLANS: Record<string, { monthlyPrice: number; yearlyPrice: number; name: string }> = {
  transfer_5gb: { monthlyPrice: 1290, yearlyPrice: 12384, name: "Transfer 5GB" },
  transfer_20gb: { monthlyPrice: 2490, yearlyPrice: 23904, name: "Transfer 20GB" },
  transfer_50gb: { monthlyPrice: 3490, yearlyPrice: 33504, name: "Transfer 50GB" },
  transfer_100gb: { monthlyPrice: 5990, yearlyPrice: 57504, name: "Transfer 100GB" },
  combo_pro_select2k: { monthlyPrice: 4490, yearlyPrice: 45259, name: "Studio Pro + Select 2k" },
  combo_completo: { monthlyPrice: 6490, yearlyPrice: 66198, name: "Studio Pro + Select 2k + Transfer 20GB" },
};

// Plans that grant subscription credits per cycle
const PLAN_SUBSCRIPTION_CREDITS: Record<string, number> = {
  combo_pro_select2k: 2000,
  combo_completo: 2000,
};

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
    const { planType, billingCycle, creditCard, creditCardHolderInfo, remoteIp } = await req.json();

    // Validate plan
    const plan = PLANS[planType];
    if (!plan) {
      return new Response(
        JSON.stringify({ error: "Invalid plan type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["MONTHLY", "YEARLY"].includes(billingCycle)) {
      return new Response(
        JSON.stringify({ error: "Invalid billing cycle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate credit card data
    if (!creditCard?.number || !creditCard?.holderName || !creditCard?.expiryMonth || !creditCard?.expiryYear || !creditCard?.ccv) {
      return new Response(
        JSON.stringify({ error: "Dados do cartão incompletos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!creditCardHolderInfo?.name || !creditCardHolderInfo?.cpfCnpj || !creditCardHolderInfo?.postalCode || !creditCardHolderInfo?.phone) {
      return new Response(
        JSON.stringify({ error: "Dados do titular incompletos" }),
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

    // Get customer ID
    const { data: account } = await adminClient
      .from("photographer_accounts")
      .select("asaas_customer_id")
      .eq("user_id", userId)
      .single();

    if (!account?.asaas_customer_id) {
      return new Response(
        JSON.stringify({ error: "Customer not found. Create customer first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing active subscription of same plan type
    const { data: existing } = await adminClient
      .from("subscriptions_asaas")
      .select("id")
      .eq("user_id", userId)
      .eq("plan_type", planType)
      .in("status", ["ACTIVE", "PENDING"])
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "Você já possui uma assinatura ativa para este plano." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const valueCents = billingCycle === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;
    const valueReais = valueCents / 100;

    // Create subscription with credit card (transparent checkout)
    const subscriptionPayload: Record<string, unknown> = {
      customer: account.asaas_customer_id,
      billingType: "CREDIT_CARD",
      cycle: billingCycle,
      value: valueReais,
      nextDueDate: getNextBusinessDay(),
      description: `${plan.name} - ${billingCycle === "YEARLY" ? "Anual" : "Mensal"}`,
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

    // Add remoteIp if provided (required by Asaas for transparent checkout)
    if (remoteIp) {
      subscriptionPayload.remoteIp = remoteIp;
    }

    console.log("Creating subscription with transparent checkout for plan:", planType);

    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/v3/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(subscriptionPayload),
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error("Asaas subscription error:", asaasData);
      const errorMsg =
        asaasData.errors?.[0]?.description || "Falha ao processar pagamento com cartão";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract creditCardToken for future renewals (never store raw card data)
    const creditCardToken = asaasData.creditCard?.creditCardToken || null;

    // Save subscription locally
    const { data: subscription, error: insertError } = await adminClient
      .from("subscriptions_asaas")
      .insert({
        user_id: userId,
        asaas_customer_id: account.asaas_customer_id,
        asaas_subscription_id: asaasData.id,
        plan_type: planType,
        billing_cycle: billingCycle,
        status: asaasData.status || "ACTIVE",
        value_cents: valueCents,
        next_due_date: asaasData.nextDueDate,
        metadata: {
          creditCardToken,
          creditCardBrand: asaasData.creditCard?.creditCardBrand || null,
          creditCardNumber: asaasData.creditCard?.creditCardNumber || null,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
    }

    // Grant subscription credits if plan includes them (combos)
    const subCredits = PLAN_SUBSCRIPTION_CREDITS[planType];
    if (subCredits && subCredits > 0) {
      const { error: creditError } = await adminClient.rpc("renew_subscription_credits", {
        _user_id: userId,
        _amount: subCredits,
      });
      if (creditError) {
        console.error("Failed to grant subscription credits:", creditError);
      } else {
        console.log(`Granted ${subCredits} subscription credits for plan ${planType}`);
      }
    }

    console.log("Subscription created successfully:", asaasData.id, "status:", asaasData.status);

    return new Response(
      JSON.stringify({
        subscriptionId: asaasData.id,
        status: asaasData.status,
        localId: subscription?.id,
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
