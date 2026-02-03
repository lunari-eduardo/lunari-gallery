import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, password } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for unrestricted access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find gallery by public_token
    const { data: gallery, error: galleryError } = await supabase
      .from("galerias")
      .select("*")
      .eq("public_token", token)
      .single();

    if (galleryError || !gallery) {
      return new Response(
        JSON.stringify({ error: "Galeria não encontrada", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if gallery is finalized (show completion screen instead of gallery)
    const isFinalized = gallery.status_selecao === 'confirmado' || gallery.finalized_at;
    
    if (isFinalized) {
      // Fetch studio settings for logo on finalized screen
      const { data: settings } = await supabase
        .from("gallery_settings")
        .select("studio_name, studio_logo_url, favicon_url")
        .eq("user_id", gallery.user_id)
        .single();
      
      // Build theme data for finalized screen
      const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
      const themeId = galleryConfig?.themeId as string | undefined;
      const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
      const allowDownload = galleryConfig?.allowDownload === true;
      
      let themeData = null;
      if (themeId) {
        const { data: theme } = await supabase
          .from("gallery_themes")
          .select("*")
          .eq("id", themeId)
          .maybeSingle();
        
        if (theme) {
          themeData = {
            id: theme.id,
            name: theme.name,
            backgroundMode: theme.background_mode || 'light',
            primaryColor: theme.primary_color,
            accentColor: theme.accent_color,
            emphasisColor: theme.emphasis_color,
          };
        }
      }
      
      // Use system theme with clientMode if no custom theme
      if (!themeData) {
        themeData = {
          id: 'system',
          name: 'Sistema',
          backgroundMode: clientMode,
          primaryColor: null,
          accentColor: null,
          emphasisColor: null,
        };
      }
      
      // If download is allowed, fetch selected photos for download screen
      if (allowDownload) {
        const { data: selectedPhotos } = await supabase
          .from("galeria_fotos")
          .select("id, storage_key, original_filename, filename")
          .eq("galeria_id", gallery.id)
          .eq("is_selected", true)
          .order("original_filename", { ascending: true });
        
        console.log("🔒 Gallery finalized with download enabled - returning photos for download");
        
        return new Response(
          JSON.stringify({ 
            finalized: true,
            allowDownload: true,
            sessionName: gallery.nome_sessao,
            photos: selectedPhotos || [],
            studioSettings: settings || null,
            theme: themeData,
            clientMode: clientMode,
            settings: {
              sessionFont: galleryConfig?.sessionFont || undefined,
              titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log("🔒 Gallery finalized - returning minimal data for completion screen");
      
      return new Response(
        JSON.stringify({ 
          finalized: true,
          allowDownload: false,
          sessionName: gallery.nome_sessao,
          studioSettings: settings || null,
          theme: themeData,
          clientMode: clientMode,
          settings: {
            sessionFont: galleryConfig?.sessionFont || undefined,
            titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check if gallery is in valid status for selection
    const validStatuses = ["enviado", "selecao_iniciada"];
    if (!validStatuses.includes(gallery.status)) {
      return new Response(
        JSON.stringify({ error: "Galeria não disponível", code: "NOT_AVAILABLE" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check password for private galleries
    if (gallery.permissao === "private") {
    // If no password provided, request it
      if (!password) {
        // Extract clientMode from gallery config for password screen theming
        const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
        const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
        
        return new Response(
          JSON.stringify({ 
            requiresPassword: true, 
            galleryId: gallery.id,
            sessionName: gallery.nome_sessao,
            clientMode: clientMode,  // Include for password screen theming
            // Include font settings for password screen styling
            settings: {
              sessionFont: galleryConfig?.sessionFont || undefined,
              titleCaseMode: galleryConfig?.titleCaseMode || 'normal',
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate password
      if (password !== gallery.gallery_password) {
        return new Response(
          JSON.stringify({ error: "Senha incorreta", code: "WRONG_PASSWORD" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Fetch pricing rules from session (source of truth) if gallery is linked
    let regrasCongeladas = gallery.regras_congeladas;
    
    if (gallery.session_id) {
      const { data: sessao, error: sessaoError } = await supabase
        .from("clientes_sessoes")
        .select("regras_congeladas")
        .eq("session_id", gallery.session_id)
        .single();
      
      if (!sessaoError && sessao?.regras_congeladas) {
        regrasCongeladas = sessao.regras_congeladas;
        console.log("📊 Loaded pricing rules from session:", gallery.session_id);
      }
    }

    // 5. Fetch photos for the gallery
    const { data: photos, error: photosError } = await supabase
      .from("galeria_fotos")
      .select("*")
      .eq("galeria_id", gallery.id)
      .order("original_filename", { ascending: true });

    if (photosError) {
      console.error("Error fetching photos:", photosError);
    }

    // 6. Fetch photographer settings (for studio name, logo, etc.)
    const { data: settings } = await supabase
      .from("gallery_settings")
      .select("studio_name, studio_logo_url, favicon_url")
      .eq("user_id", gallery.user_id)
      .single();

    // 7. Build theme data - always return a theme object for consistent styling
    const galleryConfig = gallery.configuracoes as Record<string, unknown> | null;
    const themeId = galleryConfig?.themeId as string | undefined;
    const clientMode = (galleryConfig?.clientMode as 'light' | 'dark') || 'light';
    
    let themeData = null;
    if (themeId) {
      const { data: theme } = await supabase
        .from("gallery_themes")
        .select("*")
        .eq("id", themeId)
        .maybeSingle();
      
      if (theme) {
        // Updated schema: background_mode instead of background_color, emphasis_color instead of text_color
        themeData = {
          id: theme.id,
          name: theme.name,
          backgroundMode: theme.background_mode || 'light',
          primaryColor: theme.primary_color,
          accentColor: theme.accent_color,
          emphasisColor: theme.emphasis_color,
        };
        console.log("🎨 Loaded custom theme:", theme.name, "mode:", theme.background_mode);
      }
    }
    
    // CRITICAL: Always provide a theme object, using clientMode when no custom theme exists
    // This ensures the frontend consistently receives backgroundMode for all screens
    if (!themeData) {
      themeData = {
        id: 'system',
        name: 'Sistema',
        backgroundMode: clientMode, // Use photographer's chosen mode
        primaryColor: null,         // System defaults
        accentColor: null,
        emphasisColor: null,
      };
      console.log("🎨 Using system theme with mode:", clientMode);
    }

    // 8. Log first client access if not already logged
    const { data: existingAccess } = await supabase
      .from('galeria_acoes')
      .select('id')
      .eq('galeria_id', gallery.id)
      .eq('tipo', 'cliente_acessou')
      .maybeSingle();

    if (!existingAccess) {
      await supabase.from('galeria_acoes').insert({
        galeria_id: gallery.id,
        tipo: 'cliente_acessou',
        descricao: 'Cliente acessou a galeria pela primeira vez',
        user_id: null, // Anonymous client action
      });
      console.log('📊 First access logged for gallery:', gallery.id);
    }

    // 9. Return gallery data
    const saleSettings = gallery.configuracoes?.saleSettings || null;
    
    return new Response(
      JSON.stringify({
        success: true,
        gallery: {
          id: gallery.id,
          userId: gallery.user_id, // Include user_id to check payment provider
          sessionId: gallery.session_id,  // Include session_id for client-side
          sessionName: gallery.nome_sessao,
          packageName: gallery.nome_pacote,
          clientName: gallery.cliente_nome,
          clienteId: gallery.cliente_id, // Include cliente_id for payment creation
          includedPhotos: gallery.fotos_incluidas,
          extraPhotoPrice: gallery.valor_foto_extra,
          welcomeMessage: gallery.mensagem_boas_vindas,
          deadline: gallery.prazo_selecao,
          status: gallery.status,
          selectionStatus: gallery.status_selecao,
          selectedCount: gallery.fotos_selecionadas,
          totalPhotos: gallery.total_fotos,
          settings: gallery.configuracoes,
          permissao: gallery.permissao,
          // Include frozen pricing rules (from session if available, else gallery)
          regrasCongeladas,
          // Include sale settings explicitly for payment flow
          saleSettings,
          // Include extras already paid for credit system
          extrasPagasTotal: gallery.total_fotos_extras_vendidas || 0,
          // Include amount already paid for credit calculation
          valorTotalVendido: gallery.valor_total_vendido || 0,
        },
        photos: photos || [],
        studioSettings: settings || null,
        // Theme data for client gallery appearance
        theme: themeData,
        clientMode: clientMode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gallery access error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
