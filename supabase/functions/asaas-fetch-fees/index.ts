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
  discount?: {
    active: boolean;
    expiration?: string;
    tiers: Array<{ min: number; max: number; percentageFee: number }>;
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

    // ── Parse payment.creditCard ──
    const payment = feesData.payment || {};
    const creditCard = payment.creditCard || {};
    const pix = payment.pix || {};

    // ── Parse anticipation.creditCard (separate section!) ──
    const anticipation = feesData.anticipation || {};
    const anticipationCC = anticipation.creditCard || {};

    // ── Build standard tiers from correct field names ──
    const oneInstallment = creditCard.oneInstallmentPercentage;
    const upToSix = creditCard.upToSixInstallmentsPercentage;
    const upToTwelve = creditCard.upToTwelveInstallmentsPercentage;
    const upToTwentyOne = creditCard.upToTwentyOneInstallmentsPercentage;

    const tiers: Array<{ min: number; max: number; percentageFee: number }> = [];

    if (oneInstallment !== undefined) {
      if (upToSix !== undefined || upToTwelve !== undefined) {
        tiers.push({ min: 1, max: 1, percentageFee: oneInstallment });
        if (upToSix !== undefined) tiers.push({ min: 2, max: 6, percentageFee: upToSix });
        if (upToTwelve !== undefined) tiers.push({ min: 7, max: 12, percentageFee: upToTwelve });
        if (upToTwentyOne !== undefined) tiers.push({ min: 13, max: 21, percentageFee: upToTwentyOne });
      } else {
        tiers.push({ min: 1, max: 21, percentageFee: oneInstallment });
      }
    } else {
      // Absolute fallback
      tiers.push({ min: 1, max: 21, percentageFee: 2.99 });
    }

    // ── Discount tiers (when hasValidDiscount is true) ──
    let discountInfo: AccountFees['discount'] = undefined;
    const hasDiscount = creditCard.hasValidDiscount === true;
    const discountExpiration = creditCard.discountExpiration;

    // Only use discount if it hasn't expired
    const discountStillValid = hasDiscount && (
      !discountExpiration || new Date(discountExpiration) > new Date()
    );

    if (discountStillValid) {
      const discountTiers: Array<{ min: number; max: number; percentageFee: number }> = [];
      const dOne = creditCard.discountOneInstallmentPercentage;
      const dSix = creditCard.discountUpToSixInstallmentsPercentage;
      const dTwelve = creditCard.discountUpToTwelveInstallmentsPercentage;
      const dTwentyOne = creditCard.discountUpToTwentyOneInstallmentsPercentage;

      if (dOne !== undefined) {
        if (dSix !== undefined || dTwelve !== undefined) {
          discountTiers.push({ min: 1, max: 1, percentageFee: dOne });
          if (dSix !== undefined) discountTiers.push({ min: 2, max: 6, percentageFee: dSix });
          if (dTwelve !== undefined) discountTiers.push({ min: 7, max: 12, percentageFee: dTwelve });
          if (dTwentyOne !== undefined) discountTiers.push({ min: 13, max: 21, percentageFee: dTwentyOne });
        } else {
          discountTiers.push({ min: 1, max: 21, percentageFee: dOne });
        }
      }

      if (discountTiers.length > 0) {
        discountInfo = {
          active: true,
          expiration: discountExpiration,
          tiers: discountTiers,
        };
      }
    }

    const accountFees: AccountFees = {
      creditCard: {
        operationValue: creditCard.operationValue ?? 0.49,
        detachedMonthlyFeeValue: anticipationCC.detachedMonthlyFeeValue ?? 1.25,
        installmentMonthlyFeeValue: anticipationCC.installmentMonthlyFeeValue ?? 1.70,
        tiers,
      },
      pix: {
        fixedFeeValue: pix.fixedFeeValue ?? pix.operationValue ?? 0.99,
      },
      ...(discountInfo ? { discount: discountInfo } : {}),
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
