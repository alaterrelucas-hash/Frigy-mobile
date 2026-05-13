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
        max_tokens: 1024,
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
              text: `Analyse cette photo et identifie tous les produits alimentaires visibles.
Pour chaque produit retourne un objet JSON avec ces champs :
- name: nom du produit en français (string)
- brand: marque si visible, sinon null
- category: catégorie parmi: boisson, laitage, viande, poisson, fruit, légume, épicerie, surgelé, pain, café, autre
- dlc: date de péremption si visible au format "YYYY-MM-DD", sinon null
- emoji: un emoji qui représente ce produit
- days_left: durée de conservation estimée en jours depuis aujourd'hui (entier)

Réponds UNIQUEMENT avec un JSON array valide, sans texte ni markdown autour. Exemple:
[{"name":"Lait demi-écrémé","brand":"Lactel","category":"laitage","dlc":null,"emoji":"🥛","days_left":7}]`,
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
