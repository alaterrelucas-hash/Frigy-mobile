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
          model: 'claude-sonnet-4-6',
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

Formats courants sur les emballages : 15/06/26, 15/06/2028, 15.06.2028, 06/2028, 06/28, JUN 2028, 15 JUN 2028, 2028-06-15.

RÈGLES DE CONVERSION vers DD/MM/YYYY :
- JJ/MM/AA → ajoute 2000 (ex: 15/06/28 → "15/06/2028")
- MM/AAAA ou MM/AA → utilise "01" comme jour (ex: 06/2028 → "01/06/2028")
- AAAA-MM-JJ → inverse (ex: 2028-06-15 → "15/06/2028")
- JJ MMM AAAA → convertis le mois en chiffre (ex: 15 JUN 2028 → "15/06/2028")

IMPORTANT : Lis chaque chiffre de l'année SÉPARÉMENT et avec précision. Une erreur sur le dernier chiffre (ex: lire 6 au lieu de 8) donne une date complètement fausse. Si l'année semble être dans le passé ou avant 2026, relis attentivement — il s'agit probablement d'une erreur de lecture.

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
        model: 'claude-sonnet-4-6',
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
Analyse cette photo et liste TOUS les produits alimentaires visibles que tu identifies.

Règles :
- Lis le nom EXACT écrit sur l'emballage
- Si plusieurs unités identiques du même produit sont visibles, compte-les et indique la quantité (ne crée pas d'entrée séparée par unité)
- Regroupe les exemplaires identiques : 3 boîtes de Corn Pops = 1 entrée avec quantity: 3
- Lis la date de péremption si clairement visible
- Pour les fruits et légumes sans emballage : nom générique suffit
- Sois exhaustif : ne rate aucun produit visible même partiellement

Pour chaque produit identifiable, retourne :
- name: nom exact lu sur l'emballage en français
- brand: marque lue sur l'emballage, null si non visible
- quantity: nombre d'unités identiques visibles (entier >= 1)
- category: une parmi: boisson, laitage, viande, poisson, fruit, légume, épicerie, surgelé, pain, café, autre
- dlc: date de péremption au format "YYYY-MM-DD" ou "YYYY-MM" si lisible, sinon null
- emoji: emoji le plus représentatif du produit
- days_left: durée de conservation typique en jours (lait ouvert=5, yaourt=21, fromage=14, viande crue=3, poisson=2, pain=3, pâtes=365, café=365, boisson gazeuse=90, jus=7, conserve=730)

Réponds UNIQUEMENT avec un JSON array valide, sans markdown ni texte autour. Si rien d'identifiable : []`,
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
