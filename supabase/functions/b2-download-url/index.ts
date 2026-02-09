import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  galleryId: string;
  storageKeys: string[];
}

interface SignedUrlResponse {
  storageKey: string;
  url: string;
  filename: string;
}

// B2 API endpoints
const B2_AUTH_URL = 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account';

async function authorizeB2(): Promise<{
  authorizationToken: string;
  apiUrl: string;
  downloadUrl: string;
}> {
  const keyId = Deno.env.get('B2_APPLICATION_KEY_ID');
  const key = Deno.env.get('B2_APPLICATION_KEY');

  if (!keyId || !key) {
    throw new Error('B2 credentials not configured');
  }

  const credentials = btoa(`${keyId}:${key}`);

  const response = await fetch(B2_AUTH_URL, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('B2 auth failed:', error);
    throw new Error('Failed to authorize with B2');
  }

  const data = await response.json();
  return {
    authorizationToken: data.authorizationToken,
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
  };
}

async function getDownloadAuthorization(
  apiUrl: string,
  authToken: string,
  bucketId: string,
  fileNamePrefix: string,
  validDurationInSeconds: number = 3600
): Promise<string> {
  const response = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId,
      fileNamePrefix,
      validDurationInSeconds,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('B2 download auth failed:', error);
    throw new Error('Failed to get download authorization');
  }

  const data = await response.json();
  return data.authorizationToken;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { galleryId, storageKeys } = (await req.json()) as RequestBody;

    if (!galleryId || !storageKeys || storageKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing galleryId or storageKeys' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to prevent abuse
    if (storageKeys.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Maximum 500 files per request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate gallery exists, is finalized, and has download enabled
    const { data: gallery, error: galleryError } = await supabase
      .from('galerias')
      .select('id, finalized_at, configuracoes')
      .eq('id', galleryId)
      .single();

    if (galleryError || !gallery) {
      console.error('Gallery not found:', galleryError);
      return new Response(
        JSON.stringify({ error: 'Gallery not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if gallery is finalized
    if (!gallery.finalized_at) {
      return new Response(
        JSON.stringify({ error: 'Gallery not finalized yet' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if download is allowed
    const config = gallery.configuracoes as Record<string, unknown> | null;
    const allowDownload = config?.allowDownload === true;

    if (!allowDownload) {
      return new Response(
        JSON.stringify({ error: 'Download not allowed for this gallery' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that photos belong to this gallery
    const { data: photos, error: photosError } = await supabase
      .from('galeria_fotos')
      .select('storage_key, original_filename, filename')
      .eq('galeria_id', galleryId)
      .in('storage_key', storageKeys);

    if (photosError) {
      console.error('Error fetching photos:', photosError);
      return new Response(
        JSON.stringify({ error: 'Failed to validate photos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a map for quick lookup
    const photoMap = new Map(
      photos?.map((p) => [p.storage_key, p.original_filename || p.filename]) || []
    );

    // Filter to only valid storage keys that exist in gallery
    const validStorageKeys = storageKeys.filter((key) => photoMap.has(key));

    if (validStorageKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid photos found for this gallery' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorize with B2
    const { authorizationToken, apiUrl, downloadUrl } = await authorizeB2();
    const bucketId = Deno.env.get('B2_BUCKET_ID')!;
    const bucketName = Deno.env.get('B2_BUCKET_NAME')!;

    // Get a common prefix for all files (galleries/{id}/)
    // This gives download access to all files under that prefix
    const galleryPrefix = `galleries/${galleryId}/`;
    
    const downloadAuthToken = await getDownloadAuthorization(
      apiUrl,
      authorizationToken,
      bucketId,
      galleryPrefix,
      3600 // 1 hour validity
    );

    // Build signed URLs for each file
    const urls: SignedUrlResponse[] = validStorageKeys.map((storageKey) => {
      const filename = photoMap.get(storageKey) || storageKey.split('/').pop() || 'photo.jpg';
      const signedUrl = `${downloadUrl}/file/${bucketName}/${storageKey}?Authorization=${downloadAuthToken}`;
      
      return {
        storageKey,
        url: signedUrl,
        filename,
      };
    });

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return new Response(
      JSON.stringify({
        success: true,
        urls,
        expiresIn: 3600,
        expiresAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in b2-download-url:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
