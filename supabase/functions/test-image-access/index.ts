import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function de Diagnóstico para testar acesso B2 → Cloudinary
 * 
 * Testa:
 * 1. Autorização B2 (obtém downloadUrl dinâmico)
 * 2. Acesso direto ao B2 via HEAD request
 * 3. Acesso via Cloudinary Fetch API com URL encoded
 * 4. Acesso via Cloudinary Fetch API SEM encoding
 */

interface B2AuthResponse {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
  allowed: {
    bucketId: string;
    bucketName: string;
    capabilities: string[];
  };
}

async function authorizeB2(): Promise<B2AuthResponse> {
  const keyId = Deno.env.get('B2_APPLICATION_KEY_ID');
  const applicationKey = Deno.env.get('B2_APPLICATION_KEY');
  
  if (!keyId || !applicationKey) {
    throw new Error('B2 credentials not configured');
  }
  
  const credentials = btoa(`${keyId}:${applicationKey}`);
  
  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`B2 auth failed: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const bucketName = Deno.env.get('B2_BUCKET_NAME') || 'lunari-gallery';
    const cloudinaryCloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME') || 'dxfjakxte';

    // 1. Buscar foto mais recente do banco
    const { data: photo, error: photoError } = await supabase
      .from('galeria_fotos')
      .select('id, storage_key, filename, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (photoError || !photo) {
      return new Response(JSON.stringify({
        error: 'No photos found in database',
        details: photoError?.message,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Autorizar B2 e obter downloadUrl dinâmico
    let b2Auth: B2AuthResponse;
    try {
      b2Auth = await authorizeB2();
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'B2 authorization failed',
        details: err instanceof Error ? err.message : String(err),
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Construir URLs
    const b2DirectUrl = `${b2Auth.downloadUrl}/file/${bucketName}/${photo.storage_key}`;
    
    // URL Cloudinary COM encoding (atual)
    const cloudinaryUrlEncoded = `https://res.cloudinary.com/${cloudinaryCloudName}/image/fetch/f_auto,q_auto,w_300/${encodeURIComponent(b2DirectUrl)}`;
    
    // URL Cloudinary SEM encoding (teste)
    const cloudinaryUrlNoEncoding = `https://res.cloudinary.com/${cloudinaryCloudName}/image/fetch/f_auto,q_auto,w_300/${b2DirectUrl}`;

    // 4. Testar acesso B2 direto
    let b2Result: any = { tested: false };
    try {
      const b2Response = await fetch(b2DirectUrl, { method: 'HEAD' });
      b2Result = {
        tested: true,
        url: b2DirectUrl,
        status: b2Response.status,
        statusText: b2Response.statusText,
        contentType: b2Response.headers.get('content-type'),
        contentLength: b2Response.headers.get('content-length'),
        ok: b2Response.ok,
      };
    } catch (err) {
      b2Result = {
        tested: true,
        url: b2DirectUrl,
        error: err instanceof Error ? err.message : String(err),
        ok: false,
      };
    }

    // 5. Testar Cloudinary COM encoding
    let cloudinaryEncodedResult: any = { tested: false };
    try {
      const response = await fetch(cloudinaryUrlEncoded, { method: 'HEAD' });
      cloudinaryEncodedResult = {
        tested: true,
        url: cloudinaryUrlEncoded,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        ok: response.ok,
      };
    } catch (err) {
      cloudinaryEncodedResult = {
        tested: true,
        url: cloudinaryUrlEncoded,
        error: err instanceof Error ? err.message : String(err),
        ok: false,
      };
    }

    // 6. Testar Cloudinary SEM encoding
    let cloudinaryNoEncodingResult: any = { tested: false };
    try {
      const response = await fetch(cloudinaryUrlNoEncoding, { method: 'HEAD' });
      cloudinaryNoEncodingResult = {
        tested: true,
        url: cloudinaryUrlNoEncoding,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        ok: response.ok,
      };
    } catch (err) {
      cloudinaryNoEncodingResult = {
        tested: true,
        url: cloudinaryUrlNoEncoding,
        error: err instanceof Error ? err.message : String(err),
        ok: false,
      };
    }

    // 7. Diagnóstico
    let diagnosis = '';
    let recommendation = '';

    if (!b2Result.ok) {
      diagnosis = 'PROBLEMA_B2: Acesso direto ao B2 falhou';
      recommendation = 'Verificar bucket visibility e credenciais B2';
    } else if (cloudinaryNoEncodingResult.ok && !cloudinaryEncodedResult.ok) {
      diagnosis = 'PROBLEMA_ENCODING: Cloudinary funciona SEM encoding, mas falha COM encoding';
      recommendation = 'Remover encodeURIComponent do cloudinaryUrl.ts';
    } else if (!cloudinaryNoEncodingResult.ok && cloudinaryEncodedResult.ok) {
      diagnosis = 'OK_ENCODING: Cloudinary funciona COM encoding (atual está correto)';
      recommendation = 'Problema pode ser cache ou frontend';
    } else if (cloudinaryEncodedResult.ok && cloudinaryNoEncodingResult.ok) {
      diagnosis = 'OK_AMBOS: Ambas as URLs funcionam';
      recommendation = 'Problema é frontend ou cache. Limpar cache do browser.';
    } else {
      diagnosis = 'PROBLEMA_CLOUDINARY: Nenhuma URL Cloudinary funciona';
      recommendation = 'Verificar configurações Cloudinary: Allowed fetch domains, Strict transformations';
    }

    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      photo: {
        id: photo.id,
        storage_key: photo.storage_key,
        filename: photo.filename,
      },
      b2: {
        downloadUrl: b2Auth.downloadUrl,
        bucketName,
        ...b2Result,
      },
      cloudinary: {
        cloudName: cloudinaryCloudName,
        withEncoding: cloudinaryEncodedResult,
        withoutEncoding: cloudinaryNoEncodingResult,
      },
      diagnosis,
      recommendation,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Unexpected error',
      details: err instanceof Error ? err.message : String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
