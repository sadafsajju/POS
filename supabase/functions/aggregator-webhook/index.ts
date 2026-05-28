// Unified aggregator webhook router.
//
// Routes:    POST /functions/v1/aggregator-webhook?platform={code}
// Platforms: swiggy, zomato, deliveroo, uber_eats, just_eat
//
// For each request:
//   1. Resolve platform_configs row by (org_id implicit via RLS bypass / restaurant_id) + platform code
//   2. Verify HMAC signature against webhook_secret using a per-platform scheme
//   3. Dispatch to a platform-specific handler that maps the payload into our orders schema
//
// The Indian platform handlers (swiggy/zomato) preserve existing behaviour.
// The UK handlers are stubs — they return 501 Not Implemented because the
// payload format is platform-specific and requires the client's developer
// credentials to test. The skeleton is in place so wiring real parsers
// is a localised change.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type PlatformCode = 'swiggy' | 'zomato' | 'deliveroo' | 'uber_eats' | 'just_eat'

interface PlatformConfigRow {
  id: string
  org_id: string
  platform: PlatformCode
  is_enabled: boolean
  webhook_secret: string | null
  restaurant_id: string | null
}

interface HandlerContext {
  payload: unknown
  rawBody: string
  config: PlatformConfigRow
  supabaseAdmin: ReturnType<typeof createClient>
}

type Handler = (ctx: HandlerContext) => Promise<Response>

// =============================================
// Per-platform handlers
// =============================================

// Swiggy / Zomato: not implemented in this scaffolding either, but they
// were already stubbed out in the previous architecture. Real implementations
// need the platform's published webhook spec.
const handleSwiggy: Handler = async () => {
  return jsonResponse(501, { success: false, error: 'swiggy webhook handler not implemented' })
}

const handleZomato: Handler = async () => {
  return jsonResponse(501, { success: false, error: 'zomato webhook handler not implemented' })
}

const handleDeliveroo: Handler = async () => {
  // TODO: parse Deliveroo's POST body (Order Web v1) and INSERT into orders
  // with order_source='deliveroo', external_order_id, accept_deadline,
  // and the line items mapped from Deliveroo's menu IDs to our products.
  return jsonResponse(501, { success: false, error: 'deliveroo webhook handler not implemented' })
}

const handleUberEats: Handler = async () => {
  // TODO: parse Uber Eats' Marketplace API event ("orders.notification") and
  // INSERT into orders with order_source='uber_eats'.
  return jsonResponse(501, { success: false, error: 'uber_eats webhook handler not implemented' })
}

const handleJustEat: Handler = async () => {
  // TODO: parse Just Eat for Business' webhook payload and INSERT into orders
  // with order_source='just_eat'.
  return jsonResponse(501, { success: false, error: 'just_eat webhook handler not implemented' })
}

const HANDLERS: Record<PlatformCode, Handler> = {
  swiggy: handleSwiggy,
  zomato: handleZomato,
  deliveroo: handleDeliveroo,
  uber_eats: handleUberEats,
  just_eat: handleJustEat,
}

const VALID_PLATFORMS: ReadonlySet<PlatformCode> = new Set([
  'swiggy', 'zomato', 'deliveroo', 'uber_eats', 'just_eat',
])

// =============================================
// HMAC verification
// =============================================
//
// Different platforms use different signature schemes. They all share the
// pattern: HMAC-SHA256(secret, raw_body) compared against a header value.
// The header NAME and encoding (hex vs base64) differ per platform.

const SIGNATURE_HEADER_BY_PLATFORM: Record<PlatformCode, { header: string; encoding: 'hex' | 'base64' }> = {
  swiggy:    { header: 'x-swiggy-signature',    encoding: 'hex' },
  zomato:    { header: 'x-zomato-signature',    encoding: 'hex' },
  deliveroo: { header: 'x-deliveroo-signature', encoding: 'hex' },
  uber_eats: { header: 'x-uber-signature',      encoding: 'hex' },
  just_eat:  { header: 'x-justeat-signature',   encoding: 'hex' },
}

async function verifySignature(
  rawBody: string,
  secret: string,
  expectedSignature: string,
  encoding: 'hex' | 'base64',
): Promise<boolean> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const computed = encoding === 'hex'
    ? Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
    : btoa(String.fromCharCode(...new Uint8Array(signature)))

  // Constant-time comparison
  if (computed.length !== expectedSignature.length) return false
  let mismatch = 0
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
  }
  return mismatch === 0
}

// =============================================
// Entrypoint
// =============================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'method not allowed' })
  }

  const url = new URL(req.url)
  const platformParam = url.searchParams.get('platform') as PlatformCode | null
  const restaurantId = url.searchParams.get('restaurant_id')

  if (!platformParam || !VALID_PLATFORMS.has(platformParam)) {
    return jsonResponse(400, { success: false, error: 'unknown or missing platform query param' })
  }

  // Service-role client bypasses RLS for platform_config lookup + order insertion
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  // Locate the platform_config row. We require restaurant_id in the URL so
  // we know which org's config to use — webhooks aren't tied to a logged-in
  // user, so RLS / JWT can't disambiguate.
  let configQuery = supabaseAdmin
    .from('platform_configs')
    .select('id, org_id, platform, is_enabled, webhook_secret, restaurant_id')
    .eq('platform', platformParam)
    .eq('is_enabled', true)

  if (restaurantId) {
    configQuery = configQuery.eq('restaurant_id', restaurantId)
  }

  const { data: configRows, error: configErr } = await configQuery
  if (configErr) {
    return jsonResponse(500, { success: false, error: 'config lookup failed', details: configErr.message })
  }
  if (!configRows || configRows.length === 0) {
    return jsonResponse(404, { success: false, error: 'no enabled platform_config matched' })
  }
  if (configRows.length > 1) {
    // Ambiguity is dangerous — multiple orgs configured the same restaurant_id with this platform
    return jsonResponse(400, { success: false, error: 'restaurant_id matched multiple configs; provide a unique restaurant_id' })
  }
  const config = configRows[0] as PlatformConfigRow

  // Verify signature
  const sigSpec = SIGNATURE_HEADER_BY_PLATFORM[platformParam]
  const provided = req.headers.get(sigSpec.header)
  const rawBody = await req.text()

  if (!config.webhook_secret) {
    return jsonResponse(403, { success: false, error: 'webhook_secret not configured for this platform' })
  }
  if (!provided) {
    return jsonResponse(401, { success: false, error: `missing ${sigSpec.header} header` })
  }
  const ok = await verifySignature(rawBody, config.webhook_secret, provided, sigSpec.encoding)
  if (!ok) {
    return jsonResponse(401, { success: false, error: 'signature verification failed' })
  }

  let payload: unknown
  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    return jsonResponse(400, { success: false, error: 'invalid JSON body' })
  }

  return await HANDLERS[platformParam]({
    payload,
    rawBody,
    config,
    supabaseAdmin,
  })
})

// =============================================
// Helpers
// =============================================

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
