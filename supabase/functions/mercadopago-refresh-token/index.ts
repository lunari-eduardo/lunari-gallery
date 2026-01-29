import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      JSON.stringify({ error: 'Configuração incompleta' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { user_id } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Renovando token MP para usuário:', user_id);

    // Get current integration
    const { data: integracao, error: integracaoError } = await supabase
      .from('usuarios_integracoes')
      .select('id, refresh_token, expira_em')
      .eq('user_id', user_id)
      .eq('provedor', 'mercadopago')
      .single();

    if (integracaoError || !integracao) {
      console.error('Integração não encontrada:', integracaoError);
      return new Response(
        JSON.stringify({ error: 'Integração Mercado Pago não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integracao.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Refresh token não disponível' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh the token
    const refreshResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: mpAppId,
        client_secret: mpAppSecret,
        grant_type: 'refresh_token',
        refresh_token: integracao.refresh_token,
      }),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error('Erro ao renovar token:', errorText);
      
      // If refresh fails, mark integration as needing reconnection
      await supabase
        .from('usuarios_integracoes')
        .update({ status: 'erro_autenticacao' })
        .eq('id', integracao.id);

      return new Response(
        JSON.stringify({ error: 'Falha ao renovar token. Reconecte sua conta Mercado Pago.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await refreshResponse.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Update integration with new tokens
    const { error: updateError } = await supabase
      .from('usuarios_integracoes')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expira_em: newExpiresAt,
        status: 'ativo',
      })
      .eq('id', integracao.id);

    if (updateError) {
      console.error('Erro ao atualizar integração:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar novos tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Token renovado com sucesso, expira em:', newExpiresAt);

    return new Response(
      JSON.stringify({
        success: true,
        expires_at: newExpiresAt,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao renovar token:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
