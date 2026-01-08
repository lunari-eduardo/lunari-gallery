import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  galleryId: string;
  photoId: string;
  action: 'toggle' | 'select' | 'deselect' | 'comment';
  comment?: string;
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
    const { galleryId, photoId, action, comment } = body;

    // Validate required fields
    if (!galleryId || !photoId || !action) {
      return new Response(
        JSON.stringify({ error: 'galleryId, photoId e action são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch gallery to validate status
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, status, status_selecao, prazo_selecao, finalized_at')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      return new Response(
        JSON.stringify({ error: 'Galeria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validate gallery is in allowed status
    const allowedStatuses = ['enviado', 'selecao_iniciada', 'selecao_completa'];
    if (!allowedStatuses.includes(gallery.status)) {
      return new Response(
        JSON.stringify({ error: 'Esta galeria não está aberta para seleção' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if selection is already confirmed
    if (gallery.status_selecao === 'confirmado' || gallery.finalized_at) {
      return new Response(
        JSON.stringify({ error: 'A seleção desta galeria já foi confirmada' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Check if deadline has passed
    if (gallery.prazo_selecao) {
      const deadline = new Date(gallery.prazo_selecao);
      if (deadline < new Date()) {
        return new Response(
          JSON.stringify({ error: 'O prazo de seleção expirou' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 5. Fetch current photo state
    const { data: photo, error: photoError } = await supabase
      .from('galeria_fotos')
      .select('id, is_selected, comment')
      .eq('id', photoId)
      .eq('galeria_id', galleryId)
      .single();

    if (photoError || !photo) {
      return new Response(
        JSON.stringify({ error: 'Foto não encontrada nesta galeria' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Prepare update based on action
    let updateData: { is_selected?: boolean; comment?: string; updated_at?: string } = {
      updated_at: new Date().toISOString()
    };

    switch (action) {
      case 'toggle':
        updateData.is_selected = !photo.is_selected;
        break;
      case 'select':
        updateData.is_selected = true;
        break;
      case 'deselect':
        updateData.is_selected = false;
        break;
      case 'comment':
        updateData.comment = comment || '';
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 7. Update photo
    const { error: updateError } = await supabase
      .from('galeria_fotos')
      .update(updateData)
      .eq('id', photoId)
      .eq('galeria_id', galleryId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar seleção' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Update gallery status to selecao_iniciada if it was just 'enviado'
    if (gallery.status === 'enviado') {
      await supabase
        .from('galerias')
        .update({ status: 'selecao_iniciada', updated_at: new Date().toISOString() })
        .eq('id', galleryId);
    }

    // 9. Log action (user_id is null for anonymous client actions)
    await supabase.from('galeria_acoes').insert({
      galeria_id: galleryId,
      tipo: action === 'comment' ? 'comment_added' : (updateData.is_selected ? 'photo_selected' : 'photo_deselected'),
      descricao: action === 'comment' 
        ? `Comentário adicionado à foto` 
        : (updateData.is_selected ? 'Foto selecionada pelo cliente' : 'Foto desmarcada pelo cliente'),
      user_id: null, // Anonymous client action
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        photo: {
          id: photoId,
          is_selected: action === 'comment' ? photo.is_selected : updateData.is_selected,
          comment: action === 'comment' ? updateData.comment : photo.comment,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Client selection error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
