import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { processPaymentInternal } from "../_shared/payment-processor.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://api.asaas.com/v3";

Deno.serve(async (req) => {
  // Verificação de autorização básica para segurança do cron
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("Iniciando Cron Job de Auto-Heal para pagamentos Asaas...");

    // 1. Buscar parcelas pendentes (status 'PENDING') criadas há mais de 10 minutos
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: installments, error: fetchError } = await supabase
      .from("gallery_post_payment_installments")
      .select("*")
      .eq("status", "PENDING")
      .lt("created_at", tenMinutesAgo)
      .limit(20); // Processar em lotes para evitar timeout

    if (fetchError) throw fetchError;

    console.log(`Encontradas ${installments?.length || 0} parcelas pendentes para verificação.`);

    const results = [];

    for (const inst of (installments || [])) {
      try {
        // 2. Consultar o status real no Asaas
        const response = await fetch(`${ASAAS_API_URL}/payments/${inst.gateway_id}`, {
          headers: { "access_token": ASAAS_API_KEY! }
        });

        if (!response.ok) {
          console.error(`Erro ao consultar Asaas para ${inst.gateway_id}: ${response.status}`);
          continue;
        }

        const paymentData = await response.json();
        
        // 3. Se estiver pago (RECEIVED ou CONFIRMED), processar o auto-heal
        if (["RECEIVED", "CONFIRMED"].includes(paymentData.status)) {
          console.log(`Pagamento órfão detectado e confirmado: ${inst.gateway_id}. Iniciando auto-heal...`);
          
          await processPaymentInternal(supabase, {
            paymentId: inst.gateway_id,
            status: paymentData.status,
            billingType: paymentData.billingType,
            paymentDate: paymentData.paymentDate || new Date().toISOString(),
            installmentNumber: inst.installment_number,
            originalEvent: "cron_auto_heal"
          });

          results.push({ id: inst.gateway_id, status: "healed" });
        } else {
          results.push({ id: inst.gateway_id, status: paymentData.status });
        }
      } catch (err) {
        console.error(`Erro ao processar auto-heal para ${inst.gateway_id}:`, err);
        results.push({ id: inst.gateway_id, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Erro crítico no cron auto-heal:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
