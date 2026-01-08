import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  galleryId: string;
  selectedCount: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { galleryId, selectedCount } = body;

    // Validate required fields
    if (!galleryId) {
      return new Response(
        JSON.stringify({ error: 'galleryId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch gallery to validate status
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, status, status_selecao, finalized_at, user_id')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      console.error('Gallery fetch error:', galleryError);
      return new Response(
        JSON.stringify({ error: 'Galeria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Check if selection is already confirmed
    if (gallery.status_selecao === 'confirmado' || gallery.finalized_at) {
      return new Response(
        JSON.stringify({ error: 'A seleção desta galeria já foi confirmada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Confirm selection - update gallery
    const { error: updateError } = await supabase
      .from('galerias')
      .update({
        status: 'selecao_completa',
        status_selecao: 'confirmado',
        finalized_at: new Date().toISOString(),
        fotos_selecionadas: selectedCount || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', galleryId);

    if (updateError) {
      console.error('Gallery update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao confirmar seleção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Log action in history (user_id can be null for client actions)
    const { error: logError } = await supabase.from('galeria_acoes').insert({
      galeria_id: galleryId,
      tipo: 'selecao_confirmada',
      descricao: `Cliente confirmou seleção de ${selectedCount || 0} fotos`,
      user_id: null, // Anonymous client action
    });

    if (logError) {
      console.error('Log insert error:', logError);
      // Don't fail the request, just log the error
    }

    console.log(`Gallery ${galleryId} selection confirmed with ${selectedCount} photos`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        selectedCount,
        message: 'Seleção confirmada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Confirm selection error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
