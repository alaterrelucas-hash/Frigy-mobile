import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageBase64, mimeType } = await req.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType ?? 'image/jpeg', data: imageBase64 },
            },
            {
              type: 'text',
              text: `Tu es expert en analyse de tickets de caisse français (Carrefour, Lidl, Intermarché, Monoprix, etc.).

Analyse ce ticket et liste UNIQUEMENT les produits alimentaires.

Pour chaque produit alimentaire identifié retourne :
- name: nom simplifié en français (ex: "Lait demi-écrémé" pas "LAI DEMI ECRE 1L")
- brand: marque si lisible, null sinon
- quantity: quantité achetée (entier, souvent 1)
- unit_price: prix unitaire en euros (float, ex: 1.29)
- total_price: prix total ligne en euros (float)
- category: une parmi: boisson, laitage, viande, poisson, fruit, légume, épicerie, surgelé, pain, café, autre
- emoji: emoji représentatif

Retourne aussi à la racine :
- store: nom du magasin si visible sur le ticket, null sinon
- total: montant total TTC du ticket si visible, null sinon

Règles :
- Ignore les articles non-alimentaires (hygiène, lessives, journaux...)
- Interprète les abréviations courantes sur tickets (LAI=lait, YAO=yaourt, etc.)
- Si un prix est illisible, mets null

Réponds UNIQUEMENT avec ce JSON valide, sans markdown :
{"store": "...", "total": 0.00, "items": [...]}
Si aucun produit alimentaire lisible : {"store": null, "total": null, "items": []}`,
            },
          ],
        }],
      }),
    })

    const data = await response.json()
    const content = data.content?.[0]?.text?.trim() ?? '{}'

    let result: { store: string | null; total: number | null; items: unknown[] } = { store: null, total: null, items: [] }
    try {
      result = JSON.parse(content)
    } catch {
      const match = content.match(/\{[\s\S]*\}/)
      if (match) try { result = JSON.parse(match[0]) } catch { /* ignore */ }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message, store: null, total: null, items: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
