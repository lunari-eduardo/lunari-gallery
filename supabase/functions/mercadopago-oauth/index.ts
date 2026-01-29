import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
  public_key: string;
  live_mode: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const mpAppId = Deno.env.get('MERCADOPAGO_APP_ID');
  const mpAppSecret = Deno.env.get('MERCADOPAGO_APP_SECRET');

  if (!mpAppId || !mpAppSecret) {
    console.error('MERCADOPAGO_APP_ID ou MERCADOPAGO_APP_SECRET não configurados');
    return new Response(
      JSON.stringify({ error: 'Configuração do Mercado Pago incompleta' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate user authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get user from token
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
  
  if (claimsError || !claimsData.user) {
    return new Response(
      JSON.stringify({ error: 'Token inválido' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = claimsData.user.id;

  try {
    const body = await req.json();
    const { code, redirect_uri } = body;

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Código de autorização não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Trocando code por access_token para usuário:', userId);

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: mpAppId,
        client_secret: mpAppSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erro ao trocar code:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao conectar conta Mercado Pago', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData: OAuthTokenResponse = await tokenResponse.json();

    console.log('Token obtido para MP user:', tokenData.user_id);

    // Calculate expiration date (expires_in is in seconds)
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Check if integration already exists
    const { data: existing } = await supabase
      .from('usuarios_integracoes')
      .select('id')
      .eq('user_id', userId)
      .eq('provedor', 'mercadopago')
      .maybeSingle();

    const integrationData = {
      user_id: userId,
      provedor: 'mercadopago',
      status: 'ativo',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      mp_user_id: String(tokenData.user_id),
      mp_public_key: tokenData.public_key,
      expira_em: expiresAt,
      conectado_em: new Date().toISOString(),
      dados_extras: {
        habilitarPix: true,
        habilitarCartao: true,
        maxParcelas: 12,
        absorverTaxa: false,
        live_mode: tokenData.live_mode,
      },
    };

    let result;
    if (existing) {
      // Update existing integration
      result = await supabase
        .from('usuarios_integracoes')
        .update(integrationData)
        .eq('id', existing.id);
    } else {
      // Insert new integration
      result = await supabase
        .from('usuarios_integracoes')
        .insert([{ ...integrationData, is_default: false }]);
    }

    if (result.error) {
      console.error('Erro ao salvar integração:', result.error);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar credenciais' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Integração Mercado Pago salva com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true,
        mp_user_id: tokenData.user_id,
        live_mode: tokenData.live_mode,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no OAuth:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar OAuth' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
