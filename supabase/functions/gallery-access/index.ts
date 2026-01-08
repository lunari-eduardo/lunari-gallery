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

    // 2. Check if gallery is in valid status
    const validStatuses = ["enviado", "selecao_iniciada", "selecao_completa"];
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
        return new Response(
          JSON.stringify({ 
            requiresPassword: true, 
            galleryId: gallery.id,
            sessionName: gallery.nome_sessao,
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

    // 4. Fetch photos for the gallery
    const { data: photos, error: photosError } = await supabase
      .from("galeria_fotos")
      .select("*")
      .eq("galeria_id", gallery.id)
      .order("order_index", { ascending: true });

    if (photosError) {
      console.error("Error fetching photos:", photosError);
    }

    // 5. Fetch photographer settings (for studio name, logo, etc.)
    const { data: settings } = await supabase
      .from("gallery_settings")
      .select("studio_name, studio_logo_url, favicon_url")
      .eq("user_id", gallery.user_id)
      .single();

    // 6. Return gallery data
    return new Response(
      JSON.stringify({
        success: true,
        gallery: {
          id: gallery.id,
          sessionName: gallery.nome_sessao,
          packageName: gallery.nome_pacote,
          clientName: gallery.cliente_nome,
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
        },
        photos: photos || [],
        studioSettings: settings || null,
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
