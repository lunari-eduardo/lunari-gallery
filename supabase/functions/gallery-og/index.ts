import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_USER_AGENTS = [
  "whatsapp",
  "facebookexternalhit",
  "facebookcatalog",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "telegrambot",
  "discordbot",
  "googlebot",
  "bingbot",
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((bot) => ua.includes(bot));
}

const GALLERY_BASE_URL = "https://gallery.lunarihub.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing token", { status: 400, headers: corsHeaders });
    }

    const galleryUrl = `${GALLERY_BASE_URL}/g/${token}`;
    const userAgent = req.headers.get("user-agent") || "";

    // If not a bot, redirect immediately
    if (!isBot(userAgent)) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: galleryUrl },
      });
    }

    // Bot detected — fetch gallery + photographer data for OG tags
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: gallery, error } = await supabase
      .from("galerias")
      .select("nome_sessao, user_id")
      .eq("public_token", token)
      .single();

    if (error || !gallery) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: galleryUrl },
      });
    }

    // Fetch photographer settings (logo + studio name)
    const { data: settings } = await supabase
      .from("gallery_settings")
      .select("studio_logo_url, studio_name")
      .eq("user_id", gallery.user_id)
      .single();

    const sessionName = gallery.nome_sessao || "Sessão de Fotos";
    const studioName = settings?.studio_name || "";
    const studioLogo = settings?.studio_logo_url || "";

    const ogTitle = studioName ? `${sessionName} | ${studioName}` : sessionName;
    const ogDescription = "Clique e escolha suas fotos!";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(ogTitle)}</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:url" content="${escapeHtml(galleryUrl)}">
  ${studioLogo ? `<meta property="og:image" content="${escapeHtml(studioLogo)}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  ${studioLogo ? `<meta name="twitter:image" content="${escapeHtml(studioLogo)}">` : ""}
  <meta http-equiv="refresh" content="0;url=${escapeHtml(galleryUrl)}">
</head>
<body>
  <p>Redirecionando para <a href="${escapeHtml(galleryUrl)}">${escapeHtml(ogTitle)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("gallery-og error:", err);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
