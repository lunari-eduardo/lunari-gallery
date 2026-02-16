import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  galleryId: string;
  photoId?: string;
  action: 'toggle' | 'select' | 'deselect' | 'comment' | 'favorite' | 'finalize_payment';
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
    if (!galleryId || !action) {
      return new Response(
        JSON.stringify({ error: 'galleryId e action são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle finalize_payment action (PIX Manual confirmation by client)
    if (action === 'finalize_payment') {
      const { data: gallery, error: galleryError } = await supabase
        .from('galerias')
        .select('id, status_selecao, session_id')
        .eq('id', galleryId)
        .single();

      if (galleryError || !gallery) {
        return new Response(
          JSON.stringify({ error: 'Galeria não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (gallery.status_selecao !== 'aguardando_pagamento') {
        return new Response(
          JSON.stringify({ error: 'Esta galeria não está aguardando pagamento' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Finalize the gallery
      const now = new Date().toISOString();
      await supabase
        .from('galerias')
        .update({
          status_selecao: 'selecao_completa',
          finalized_at: now,
          status_pagamento: 'aguardando_confirmacao',
          updated_at: now,
        })
        .eq('id', galleryId);

      // Update session if linked
      if (gallery.session_id) {
        await supabase
          .from('clientes_sessoes')
          .update({ status_galeria: 'selecao_completa', updated_at: now })
          .eq('session_id', gallery.session_id);
      }

      // Log action
      await supabase.from('galeria_acoes').insert({
        galeria_id: galleryId,
        tipo: 'pagamento_informado',
        descricao: 'Cliente informou pagamento PIX manual',
        user_id: null,
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Pagamento informado com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For photo actions, photoId is required
    if (!photoId) {
      return new Response(
        JSON.stringify({ error: 'photoId é obrigatório para esta ação' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Fetch gallery to validate status
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, status, status_selecao, prazo_selecao, finalized_at, session_id')
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
    if (gallery.status_selecao === 'selecao_completa' || gallery.finalized_at) {
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
      .select('id, is_selected, is_favorite, comment')
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
    let updateData: { is_selected?: boolean; is_favorite?: boolean; comment?: string; updated_at?: string } = {
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
      case 'favorite':
        updateData.is_favorite = !photo.is_favorite;
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
      
      // Update session status if linked
      // Note: gallery.session_id is the workflow string 'session_id' column
      if (gallery.session_id) {
        await supabase
          .from('clientes_sessoes')
          .update({ 
            status_galeria: 'em_selecao', 
            updated_at: new Date().toISOString() 
          })
          .eq('session_id', gallery.session_id);
        console.log(`Session ${gallery.session_id} status updated to em_selecao`);
      }
    }

    // 9. Log action (user_id is null for anonymous client actions)
    const actionType = action === 'comment' 
      ? 'comment_added' 
      : action === 'favorite'
        ? (updateData.is_favorite ? 'photo_favorited' : 'photo_unfavorited')
        : (updateData.is_selected ? 'photo_selected' : 'photo_deselected');
    const actionDesc = action === 'comment' 
      ? 'Comentário adicionado à foto' 
      : action === 'favorite'
        ? (updateData.is_favorite ? 'Foto favoritada pelo cliente' : 'Foto desfavoritada pelo cliente')
        : (updateData.is_selected ? 'Foto selecionada pelo cliente' : 'Foto desmarcada pelo cliente');
    
    await supabase.from('galeria_acoes').insert({
      galeria_id: galleryId,
      tipo: actionType,
      descricao: actionDesc,
      user_id: null, // Anonymous client action
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        photo: {
          id: photoId,
          is_selected: action === 'comment' || action === 'favorite' ? photo.is_selected : updateData.is_selected,
          is_favorite: action === 'favorite' ? updateData.is_favorite : photo.is_favorite,
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
