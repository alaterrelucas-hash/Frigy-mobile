import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64, mimeType, mode } = await req.json()

    if (mode === 'dlc_only') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mimeType ?? 'image/jpeg', data: imageBase64 },
              },
              {
                type: 'text',
                text: `Tu es expert en lecture d'emballages alimentaires. Cherche dans cette image TOUTE séquence de chiffres qui ressemble à une date d'expiration.

Indices visuels : cherche près des mots DLC, DDM, DLUO, BBE, EXP, "Best Before", "Consommer avant", "À consommer avant le", ou simplement une date isolée sur l'emballage.

Formats courants sur les emballages : 15/06/26, 15/06/2026, 15.06.2026, 06/2026, 06/26, JUN 2026, 15 JUN 2026, 2026-06-15.

RÈGLES DE CONVERSION vers DD/MM/YYYY :
- JJ/MM/AA → ajoute 2000 (ex: 15/06/26 → "15/06/2026")
- MM/AAAA ou MM/AA → utilise "01" comme jour (ex: 06/2026 → "01/06/2026")
- AAAA-MM-JJ → inverse (ex: 2026-06-15 → "15/06/2026")
- JJ MMM AAAA → convertis le mois en chiffre (ex: 15 JUN 2026 → "15/06/2026")

Réponds UNIQUEMENT avec ce JSON, sans markdown :
{"dlc": "DD/MM/YYYY"}
ou {"dlc": null} SEULEMENT si vraiment aucun chiffre ressemblant à une date n'est visible du tout.`,
              },
            ],
          }],
        }),
      })
      const data = await response.json()
      const content = data.content?.[0]?.text?.trim() ?? '{}'
      let result: { dlc: string | null } = { dlc: null }
      try {
        result = JSON.parse(content)
      } catch {
        const match = content.match(/\{[\s\S]*?\}/)
        if (match) try { result = JSON.parse(match[0]) } catch { /* ignore */ }
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
              source: {
                type: 'base64',
                media_type: mimeType ?? 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Tu es un expert en reconnaissance de produits alimentaires français.
Analyse cette photo et liste UNIQUEMENT les produits alimentaires que tu identifies avec certitude.

Règles strictes :
- Lis le nom EXACT écrit sur l'emballage, ne devine pas
- Si le texte est illisible ou le produit incertain, ne l'inclus pas
- Lis la date de péremption si elle est clairement visible sur l'emballage
- Pour les fruits et légumes sans emballage : nom générique suffit

Pour chaque produit clairement identifiable, retourne :
- name: nom exact lu sur l'emballage en français
- brand: marque lue sur l'emballage, null si non visible
- category: une parmi: boisson, laitage, viande, poisson, fruit, légume, épicerie, surgelé, pain, café, autre
- dlc: date de péremption au format "YYYY-MM-DD" ou "YYYY-MM" si lisible sur l'emballage, sinon null
- emoji: emoji le plus représentatif du produit
- days_left: durée de conservation typique en jours (exemples: lait ouvert=5, yaourt=21, fromage=14, viande crue=3, poisson=2, pain=3, pâtes=365, café=365, boisson gazeuse=90, jus=7, conserve=730)

Réponds UNIQUEMENT avec un JSON array valide, sans markdown ni texte autour. Si rien d'identifiable avec certitude : []`,
            },
          ],
        }],
      }),
    })

    const data = await response.json()
    const content = data.content?.[0]?.text ?? '[]'

    let products = []
    try {
      products = JSON.parse(content)
    } catch {
      const match = content.match(/\[[\s\S]*\]/)
      if (match) products = JSON.parse(match[0])
    }

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, products: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
