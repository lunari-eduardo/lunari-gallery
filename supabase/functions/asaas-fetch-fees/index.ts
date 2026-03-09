import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AccountFees {
  creditCard: {
    operationValue: number;
    detachedMonthlyFeeValue: number;
    installmentMonthlyFeeValue: number;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
  };
  pix: {
    fixedFeeValue: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch photographer's Asaas integration
    const { data: integracao, error: integError } = await supabase
      .from('usuarios_integracoes')
      .select('access_token, dados_extras')
      .eq('user_id', userId)
      .eq('provedor', 'asaas')
      .eq('status', 'ativo')
      .maybeSingle();

    if (integError || !integracao?.access_token) {
      console.error('Asaas integration not found:', integError);
      return new Response(
        JSON.stringify({ success: false, error: 'Integração Asaas não configurada', code: 'ASAAS_NOT_CONFIGURED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasApiKey = integracao.access_token;
    const settings = (integracao.dados_extras || {}) as { environment?: string };

    const asaasBaseUrl = settings.environment === 'production'
      ? 'https://api.asaas.com'
      : 'https://api-sandbox.asaas.com';

    // Fetch real fees from Asaas API
    const feesResp = await fetch(`${asaasBaseUrl}/v3/myAccount/fees`, {
      headers: { access_token: asaasApiKey },
    });

    if (!feesResp.ok) {
      const errText = await feesResp.text();
      console.error('Failed to fetch Asaas fees:', feesResp.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar taxas do Asaas', code: 'ASAAS_FEES_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const feesData = await feesResp.json();
    console.log('📊 Asaas fees raw:', JSON.stringify(feesData));

    // Normalize the response into our structure
    // The Asaas API returns payment, transfer, and anticipation fees
    const payment = feesData.payment || {};
    const creditCard = payment.creditCard || {};
    const pix = payment.pix || {};

    // Build tiers from Asaas response
    // Asaas returns: detachedMonthlyFeeValue, installmentMonthlyFeeValue
    // and fee tiers with percentage per installment range
    const tiers: Array<{ min: number; max: number; percentageFee: number }> = [];

    // Asaas returns creditCard with:
    // - operationValue (fixed per transaction, e.g., 0.49)
    // - oneInstallmentPercentage (e.g., 2.99)
    // - ranged percentages via installmentPercentages or similar
    
    // Try to extract tiers from API response
    if (creditCard.defaultPercentageFee !== undefined) {
      // Flat fee structure
      tiers.push({ min: 1, max: 21, percentageFee: creditCard.defaultPercentageFee });
    }

    // Check for per-installment or ranged fees from the API
    if (creditCard.creditCardFeeRanges && Array.isArray(creditCard.creditCardFeeRanges)) {
      tiers.length = 0; // Clear default
      for (const range of creditCard.creditCardFeeRanges) {
        tiers.push({
          min: range.startInstallment || range.min || 1,
          max: range.endInstallment || range.max || 21,
          percentageFee: range.percentageFee || range.fee || 0,
        });
      }
    }

    // Fallback: if no tiers found, try standard fields
    if (tiers.length === 0) {
      // Use oneInstallmentPercentage and installment percentages
      const oneInstallment = creditCard.oneInstallmentPercentage ?? creditCard.detachedPercentageFee ?? 2.99;
      
      if (creditCard.upToSixInstallmentsPercentageFee !== undefined || 
          creditCard.upToTwelveInstallmentsPercentageFee !== undefined) {
        tiers.push({ min: 1, max: 1, percentageFee: oneInstallment });
        tiers.push({ 
          min: 2, max: 6, 
          percentageFee: creditCard.upToSixInstallmentsPercentageFee ?? creditCard.installmentPercentageFee ?? 3.49 
        });
        tiers.push({ 
          min: 7, max: 12, 
          percentageFee: creditCard.upToTwelveInstallmentsPercentageFee ?? creditCard.installmentPercentageFee ?? 3.99 
        });
        // 13-21x if available
        if (creditCard.aboveTwelveInstallmentsPercentageFee !== undefined) {
          tiers.push({ min: 13, max: 21, percentageFee: creditCard.aboveTwelveInstallmentsPercentageFee });
        }
      } else {
        // Absolute fallback: single tier
        tiers.push({ min: 1, max: 21, percentageFee: oneInstallment });
      }
    }

    const accountFees: AccountFees = {
      creditCard: {
        operationValue: creditCard.operationValue ?? 0.49,
        detachedMonthlyFeeValue: creditCard.detachedMonthlyFeeValue ?? creditCard.monthlyFeeValue ?? 1.25,
        installmentMonthlyFeeValue: creditCard.installmentMonthlyFeeValue ?? creditCard.monthlyFeeValue ?? 1.70,
        tiers,
      },
      pix: {
        fixedFeeValue: pix.fixedFeeValue ?? pix.operationValue ?? 0.99,
      },
    };

    console.log('📊 Normalized Asaas fees:', JSON.stringify(accountFees));

    return new Response(
      JSON.stringify({ success: true, accountFees }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Asaas fetch fees error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
