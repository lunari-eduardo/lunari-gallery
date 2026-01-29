const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Retorna a chave pública (é segura para expor)
  const publicKey = Deno.env.get('MERCADOPAGO_PUBLIC_KEY') || '';

  return new Response(
    JSON.stringify({ public_key: publicKey }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
});
