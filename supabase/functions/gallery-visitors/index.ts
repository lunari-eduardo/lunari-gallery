import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate photographer
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { galleryId, visitorId, action } = body;

    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: 'galleryId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify gallery ownership
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, user_id')
      .eq('id', galleryId)
      .eq('user_id', user.id)
      .single();

    if (galleryError || !gallery) {
      return new Response(
        JSON.stringify({ error: 'Galeria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: update visitor status
    if (action === 'finalize' && visitorId) {
      const { error: updateError } = await supabase
        .from('galeria_visitantes')
        .update({ 
          status: 'finalizado',
          finalized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', visitorId)
        .eq('galeria_id', galleryId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Erro ao finalizar visitante' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: get specific visitor's selections
    if (visitorId) {
      const { data: visitor, error: visitorError } = await supabase
        .from('galeria_visitantes')
        .select('*')
        .eq('id', visitorId)
        .eq('galeria_id', galleryId)
        .single();

      if (visitorError || !visitor) {
        return new Response(
          JSON.stringify({ error: 'Visitante não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get selections
      const { data: selections } = await supabase
        .from('visitante_selecoes')
        .select('foto_id, is_selected, is_favorite, comment')
        .eq('visitante_id', visitorId);

      // Get photos for selected items
      const selectedFotoIds = (selections || [])
        .filter(s => s.is_selected)
        .map(s => s.foto_id);

      let selectedPhotos: any[] = [];
      if (selectedFotoIds.length > 0) {
        const { data: photos } = await supabase
          .from('galeria_fotos')
          .select('id, storage_key, original_filename, filename, width, height, thumb_path, preview_path')
          .in('id', selectedFotoIds);
        selectedPhotos = photos || [];
      }

      // Get payment info
      const { data: cobrancas } = await supabase
        .from('cobrancas')
        .select('id, valor, status, provedor, data_pagamento, created_at')
        .eq('visitor_id', visitorId)
        .order('created_at', { ascending: false });

      return new Response(
        JSON.stringify({
          visitor,
          selections: selections || [],
          selectedPhotos,
          cobrancas: cobrancas || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: list all visitors for gallery
    const { data: visitors, error: visitorsError } = await supabase
      .from('galeria_visitantes')
      .select('*')
      .eq('galeria_id', galleryId)
      .order('created_at', { ascending: false });

    if (visitorsError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar visitantes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get selection counts per visitor
    const visitorIds = (visitors || []).map(v => v.id);
    let selectionCounts: Record<string, number> = {};
    
    if (visitorIds.length > 0) {
      const { data: counts } = await supabase
        .from('visitante_selecoes')
        .select('visitante_id')
        .in('visitante_id', visitorIds)
        .eq('is_selected', true);

      if (counts) {
        for (const row of counts) {
          selectionCounts[row.visitante_id] = (selectionCounts[row.visitante_id] || 0) + 1;
        }
      }
    }

    // Get payment status per visitor
    let paymentStatuses: Record<string, string> = {};
    if (visitorIds.length > 0) {
      const { data: cobrancas } = await supabase
        .from('cobrancas')
        .select('visitor_id, status')
        .in('visitor_id', visitorIds)
        .order('created_at', { ascending: false });

      if (cobrancas) {
        for (const c of cobrancas) {
          if (c.visitor_id && !paymentStatuses[c.visitor_id]) {
            paymentStatuses[c.visitor_id] = c.status || 'sem_vendas';
          }
        }
      }
    }

    // Enrich visitors with counts
    const enrichedVisitors = (visitors || []).map(v => ({
      ...v,
      fotos_selecionadas: selectionCounts[v.id] || v.fotos_selecionadas || 0,
      status_pagamento: paymentStatuses[v.id] || 'sem_vendas',
    }));

    return new Response(
      JSON.stringify({ visitors: enrichedVisitors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Gallery visitors error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
