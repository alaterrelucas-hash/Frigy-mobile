import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { products } = await req.json()

    if (!products?.length) {
      return new Response(JSON.stringify({ recipes: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const productList = products
      .map((p: { emoji: string; name: string; days_left: number; location?: string }) =>
        `- ${p.emoji} ${p.name}${p.days_left <= 4 ? ` (J-${p.days_left}, URGENT)` : ` (J-${p.days_left})`}${p.location ? ` [${p.location}]` : ''}`
      )
      .join('\n')

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
          content: `Tu es un chef cuisinier anti-gaspillage. Voici les produits disponibles :

${productList}

Propose 3 recettes réalisables prioritairement avec les produits URGENTS.
Pour chaque recette retourne :
- name: nom de la recette en français
- emoji: emoji représentatif
- time: temps de préparation (ex: "20 min")
- diff: "Très facile", "Facile" ou "Moyen"
- ingredients: tableau des noms courts et propres des produits utilisés (sans mention J-1, URGENT ou localisation — juste le nom du produit)
- desc: description courte (1 phrase max)
- saves: économie estimée en euros (ex: "4,50")
- steps: tableau de 4 à 7 étapes de préparation numérotées, claires et précises en français (ex: ["Épluche et coupe les pommes de terre en rondelles fines.", "Fais chauffer la crème avec l'ail dans une casserole.", ...])
- imageQuery: courte requête en anglais pour trouver une photo de cette recette sur Spoonacular (ex: "cheese pasta sauce", "potato gratin", "chicken stir fry")

Réponds UNIQUEMENT avec un JSON array valide, sans markdown ni texte autour. Si impossible : []`,
        }],
      }),
    })

    const data = await response.json()
    const content = data.content?.[0]?.text ?? '[]'

    let recipes = []
    try {
      recipes = JSON.parse(content)
    } catch {
      const match = content.match(/\[[\s\S]*\]/)
      if (match) recipes = JSON.parse(match[0])
    }

    return new Response(JSON.stringify({ recipes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message, recipes: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
