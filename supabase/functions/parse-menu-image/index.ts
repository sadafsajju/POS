import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the caller is authenticated and is admin/manager
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ success: false, message: `Unauthorized: ${authError?.message || 'No user found'}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerRole = caller.app_metadata?.role
    if (callerRole !== 'admin' && callerRole !== 'manager') {
      return new Response(
        JSON.stringify({ success: false, message: `Only admins and managers can import menus (your role: ${callerRole || 'none'})` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body — expects { image_base64: string, content_type?: string }
    const body = await req.json()
    const imageBase64 = body.image_base64 as string | undefined
    const contentType = (body.content_type as string) || 'image/jpeg'

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, message: 'image_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, message: 'Gemini API key not configured. Set GEMINI_API_KEY in Supabase secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`

    const prompt = `You are a menu data extraction expert. Analyze this restaurant/cafe menu image and extract EVERY product/item visible.

For each item, extract:
- "name": The product name exactly as shown (string)
- "price": The price as a number (strip currency symbols, use 0 if not visible)
- "category": The category/section heading this item belongs to (string, e.g. "Starters", "Main Course", "Beverages")
- "description": Any description text shown for the item (string, empty string if none)

Rules:
- Extract ALL items, do not skip any
- Prices must be numbers (e.g. 299, 12.50), not strings
- If an item has multiple sizes/prices, use the base/smallest price
- If no category heading is visible, use "Uncategorized"
- Preserve the original language of item names
- Do not invent or hallucinate items that are not on the menu

Return a JSON array of objects. Example:
[{"name": "Chicken Tikka", "price": 299, "category": "Starters", "description": "Tender chicken marinated in spices"}]`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: contentType, data: imageBase64 } }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        }
      })
    })

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      console.error('Gemini API error:', errText)
      return new Response(
        JSON.stringify({ success: false, message: `Gemini API error (${geminiResponse.status}): Failed to analyze menu image` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiData = await geminiResponse.json()

    // Extract the JSON from Gemini's response
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) {
      return new Response(
        JSON.stringify({ success: false, message: 'Gemini returned an empty response. Try a clearer menu image.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let items: Array<{ name: string; price: number; category: string; description: string }>
    try {
      items = JSON.parse(rawText)
    } catch {
      console.error('Failed to parse Gemini JSON:', rawText)
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to parse extracted data. Try a clearer menu image.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No menu items detected in the image. Try a clearer photo.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize: ensure each item has all required fields
    const normalized = items.map((item, i) => ({
      name: (item.name || `Item ${i + 1}`).trim(),
      price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price)) || 0,
      category: (item.category || 'Uncategorized').trim(),
      description: (item.description || '').trim(),
    }))

    return new Response(
      JSON.stringify({
        success: true,
        message: `Extracted ${normalized.length} items from menu`,
        data: normalized,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('parse-menu-image error:', err)
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
