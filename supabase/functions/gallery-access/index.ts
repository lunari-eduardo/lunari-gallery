
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const publicToken = body.publicToken || body.token
    const password = body.password
    const visitorId = body.visitorId


    // 1. Fetch gallery
    console.log(`Fetching gallery with token: ${publicToken}`)
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('*')
      .eq('public_token', publicToken)
      .maybeSingle()

    if (galleryError) {
      console.error('Database error:', galleryError)
      return new Response(JSON.stringify({ error: 'Database error', details: galleryError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    if (galleryError || !gallery) {
      return new Response(JSON.stringify({ error: 'Gallery not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Check password if private
    if (gallery.permissao === 'private' && gallery.gallery_password !== password) {
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Fetch related data
    const [
      { data: photos },
      { data: folders },
      { data: settings },
    ] = await Promise.all([
      supabase.from('galeria_fotos').select('*').eq('galeria_id', gallery.id).order('order_index'),
      supabase.from('galeria_pastas').select('*').eq('galeria_id', gallery.id).order('ordem'),
      supabase.from('gallery_settings').select('*').eq('user_id', gallery.user_id).maybeSingle(),
    ])

    // 4. Resolve Theme (Centralized logic)
    const galleryConfig = gallery.configuracoes as any || {}
    const themeId = (gallery.theme_id as string) || (galleryConfig?.themeId as string)
    const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light'

    let themeData = null
    if (themeId) {
      const { data: theme } = await supabase
        .from('gallery_themes')
        .select('*')
        .eq('id', themeId)
        .maybeSingle()
      if (theme) {
        themeData = {
          id: theme.id,
          name: theme.name,
          backgroundMode: clientMode,
          primaryColor: theme.primary_color,
          accentColor: theme.accent_color,
          emphasisColor: theme.emphasis_color,
        }
      }
    }

    if (!themeData) {
      themeData = { id: 'system', name: 'Sistema', backgroundMode: clientMode, primaryColor: null, accentColor: null, emphasisColor: null }
    }

    // 5. Response
    return new Response(
      JSON.stringify({
        success: true,
        deliver: gallery.tipo === 'entrega',
        galleryId: gallery.id, // For legacy compatibility
        gallery: {
          id: gallery.id,
          sessionName: gallery.nome_sessao,
          clientName: gallery.cliente_nome,
          clientEmail: gallery.cliente_email,
          packageName: gallery.nome_pacote,
          includedPhotos: gallery.fotos_incluidas,
          extraPhotoPrice: Number(gallery.valor_foto_extra || 0),
          selectionStatus: gallery.status_selecao,
          welcomeMessage: gallery.mensagem_boas_vindas,
          expirationDate: gallery.prazo_selecao,
          deadline: gallery.prazo_selecao, // Selection alias
          publicToken: gallery.public_token,
          regrasCongeladas: gallery.regras_congeladas,
          settings: {
            sessionFont: galleryConfig?.sessionFont || undefined,
            titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
            coverPhotoId: galleryConfig?.coverPhotoId || undefined,
            photoSpacing: galleryConfig?.photoSpacing || undefined,
            themeId: themeId || undefined,
            useCustomTheme: (gallery.use_custom_theme as boolean) ?? !!gallery.theme_id,
            themeOverrides: (gallery.theme_overrides as any) || galleryConfig?.themeOverrides || undefined,
          },
        },
        photos: photos || [],
        folders: folders || [],
        studioSettings: settings || null,
        theme: themeData,
        clientMode,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
