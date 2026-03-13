import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verify user with anon client
    const anonClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const userId = claimsData.claims.sub as string

    // Parse body
    const { device_fingerprint, event_type = 'login' } = await req.json()

    if (!device_fingerprint || typeof device_fingerprint !== 'string' || device_fingerprint.length < 16) {
      return new Response(JSON.stringify({ error: 'Invalid fingerprint' }), { status: 400, headers: corsHeaders })
    }

    // Extract real IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || req.headers.get('x-real-ip')
      || 'unknown'

    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Use service client to call the RPC
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await serviceClient.rpc('record_device_fingerprint', {
      _user_id: userId,
      _fingerprint: device_fingerprint,
      _ip_address: ip,
      _event_type: event_type,
      _user_agent: userAgent,
    })

    if (error) {
      console.error('Error recording fingerprint:', error)
      return new Response(JSON.stringify({ error: 'Failed to record' }), { status: 500, headers: corsHeaders })
    }

    console.log(`🔒 Fingerprint recorded for user ${userId}: duplicate=${data?.is_duplicate}`)

    return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders })
  }
})
