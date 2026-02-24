import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE_URL = Deno.env.get("ASAAS_ENV") === "production"
  ? "https://api.asaas.com"
  : "https://api-sandbox.asaas.com";

// Plan pricing in cents (yearly only - monthly uses subscription)
const PLANS: Record<string, { yearlyPrice: number; name: string }> = {
  transfer_5gb: { yearlyPrice: 12384, name: "Transfer 5GB" },
  transfer_20gb: { yearlyPrice: 23904, name: "Transfer 20GB" },
  transfer_50gb: { yearlyPrice: 33504, name: "Transfer 50GB" },
  transfer_100gb: { yearlyPrice: 57504, name: "Transfer 100GB" },
  combo_studio_pro: { yearlyPrice: 45278, name: "Studio Pro + Select 2k" },
  combo_completo: { yearlyPrice: 65478, name: "Studio Pro + Select 2k + Transfer 20GB" },
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

    const userId = user.id;
    const {
      productType,
      planType,
      packageId,
      credits,
      priceCents,
      installmentCount,
      creditCard,
      creditCardHolderInfo,
      remoteIp,
    } = await req.json();

    // Validate productType
    if (!["select", "subscription_yearly"].includes(productType)) {
      return new Response(
        JSON.stringify({ error: "Invalid productType" }),
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

    // Get or validate customer ID
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

    // Determine value and description
    let valueReais: number;
    let description: string;
    let validatedInstallments = 1;

    if (productType === "select") {
      // Select credits - always 1x
      if (!priceCents || !credits || !packageId) {
        return new Response(
          JSON.stringify({ error: "Missing package data for select payment" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      valueReais = priceCents / 100;
      description = `Compra de ${credits} créditos Gallery Select`;
      validatedInstallments = 1;
    } else {
      // subscription_yearly - 1-12x
      const plan = PLANS[planType];
      if (!plan) {
        return new Response(
          JSON.stringify({ error: "Invalid plan type" }),
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

      valueReais = plan.yearlyPrice / 100;
      description = `${plan.name} - Anual`;
      validatedInstallments = Math.min(12, Math.max(1, installmentCount || 1));
    }

    // Build payment payload
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const day = dueDate.getDay();
    if (day === 0) dueDate.setDate(dueDate.getDate() + 1);
    if (day === 6) dueDate.setDate(dueDate.getDate() + 2);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentPayload: Record<string, unknown> = {
      customer: account.asaas_customer_id,
      billingType: "CREDIT_CARD",
      value: valueReais,
      dueDate: dueDateStr,
      description,
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

    // Add installments if > 1
    if (validatedInstallments > 1) {
      paymentPayload.installmentCount = validatedInstallments;
      paymentPayload.installmentValue = Math.round((valueReais / validatedInstallments) * 100) / 100;
    }

    // Add remoteIp if provided
    if (remoteIp) {
      paymentPayload.remoteIp = remoteIp;
    }

    console.log(`Creating Asaas payment: productType=${productType}, value=${valueReais}, installments=${validatedInstallments}`);

    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/v3/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentPayload),
    });

    const asaasData = await asaasResponse.json();

    if (!asaasResponse.ok) {
      console.error("Asaas payment error:", asaasData);
      const errorMsg =
        asaasData.errors?.[0]?.description || "Falha ao processar pagamento com cartão";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentStatus = asaasData.status; // CONFIRMED, PENDING, etc.
    const paymentId = asaasData.id;
    const creditCardToken = asaasData.creditCard?.creditCardToken || null;

    console.log(`Asaas payment created: ${paymentId}, status: ${paymentStatus}`);

    // Handle Select credits
    if (productType === "select") {
      if (paymentStatus === "CONFIRMED" || paymentStatus === "RECEIVED") {
        // Create credit purchase record and add credits
        const { data: purchase, error: purchaseError } = await adminClient
          .from("credit_purchases")
          .insert({
            user_id: userId,
            package_id: packageId,
            credits_amount: credits,
            price_cents: priceCents,
            payment_method: "credit_card",
            status: "pending",
            mp_status: "approved",
            metadata: {
              provider: "asaas",
              asaas_payment_id: paymentId,
              creditCardToken,
            },
          })
          .select()
          .single();

        if (purchaseError) {
          console.error("Purchase insert error:", purchaseError);
        } else {
          // Add credits via RPC
          const { error: rpcError } = await adminClient.rpc("purchase_credits", {
            _user_id: userId,
            _amount: credits,
            _purchase_id: purchase.id,
            _description: `Compra de ${credits} créditos via cartão de crédito (Asaas)`,
          });

          if (rpcError) {
            console.error("RPC purchase_credits error:", rpcError);
          } else {
            console.log(`Credits added: ${credits} for user ${userId}`);
          }
        }
      }

      return new Response(
        JSON.stringify({
          paymentId,
          status: paymentStatus,
          productType: "select",
          credits,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle yearly subscription
    if (productType === "subscription_yearly") {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const { data: subscription, error: insertError } = await adminClient
        .from("subscriptions_asaas")
        .insert({
          user_id: userId,
          asaas_customer_id: account.asaas_customer_id,
          asaas_subscription_id: paymentId, // using payment ID as reference
          plan_type: planType,
          billing_cycle: "YEARLY",
          status: paymentStatus === "CONFIRMED" || paymentStatus === "RECEIVED" ? "ACTIVE" : "PENDING",
          value_cents: Math.round(valueReais * 100),
          next_due_date: expiresAt.toISOString().split("T")[0],
          metadata: {
            creditCardToken,
            creditCardBrand: asaasData.creditCard?.creditCardBrand || null,
            creditCardNumber: asaasData.creditCard?.creditCardNumber || null,
            installmentCount: validatedInstallments,
            paymentType: "one_time",
            expiresAt: expiresAt.toISOString(),
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert subscription error:", insertError);
      }

      return new Response(
        JSON.stringify({
          paymentId,
          status: paymentStatus === "CONFIRMED" || paymentStatus === "RECEIVED" ? "ACTIVE" : paymentStatus,
          productType: "subscription_yearly",
          localId: subscription?.id,
          installmentCount: validatedInstallments,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unhandled productType" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
