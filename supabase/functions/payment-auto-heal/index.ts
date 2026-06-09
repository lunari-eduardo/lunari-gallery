import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { processGalleryPayment } from "../_shared/payment-processor.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://api.asaas.com/v3";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("[Auto-Heal] Iniciando sincronização de pagamentos órfãos...");

    // 1. Buscar parcelas pendentes criadas há mais de 10 minutos
    // Nota: Usando a tabela 'cobranca_parcelas' que é a correta no esquema atual
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: parcelas, error: fetchError } = await supabase
      .from("cobranca_parcelas")
      .select("*, cobrancas(provedor, asaas_installment_id)")
      .eq("status", "pendente")
      .lt("created_at", tenMinutesAgo)
      .limit(20);

    if (fetchError) throw fetchError;

    console.log(`[Auto-Heal] Encontradas ${parcelas?.length || 0} parcelas pendentes.`);

    const results = [];

    for (const p of (parcelas || [])) {
      const provider = p.cobrancas?.provedor || 'asaas';
      
      if (provider === 'asaas' && p.asaas_payment_id) {
        try {
          const response = await fetch(`${ASAAS_API_URL}/payments/${p.asaas_payment_id}`, {
            headers: { "access_token": ASAAS_API_KEY! }
          });

          if (!response.ok) {
            console.error(`[Auto-Heal] Erro Asaas ${p.asaas_payment_id}: ${response.status}`);
            continue;
          }

          const paymentData = await response.json();
          
          if (["RECEIVED", "CONFIRMED"].includes(paymentData.status)) {
            console.log(`[Auto-Heal] Sincronizando pagamento pago: ${p.asaas_payment_id}`);
            
            await processGalleryPayment(supabase, {
              provider: 'asaas',
              externalId: paymentData.id,
              installmentId: paymentData.installment,
              installmentNumber: paymentData.installmentNumber || 1,
              totalInstallments: 1, // Simplificado para o heal
              value: paymentData.value,
              netValue: paymentData.netValue,
              billingType: paymentData.billingType,
              paymentDate: paymentData.paymentDate || new Date().toISOString()
            });

            results.push({ id: p.asaas_payment_id, status: "healed" });
          }
        } catch (err) {
          console.error(`[Auto-Heal] Erro ao processar ${p.asaas_payment_id}:`, err);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("[Auto-Heal] Erro crítico:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
