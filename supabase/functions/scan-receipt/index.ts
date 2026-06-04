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
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType ?? 'image/jpeg', data: imageBase64 },
            },
            {
              type: 'text',
              text: `Tu es expert en déchiffrage de tickets de caisse français (E.Leclerc, Carrefour, Lidl, Intermarché, Monoprix, etc.).

RÈGLES CRITIQUES :
1. Les lignes commencent souvent par 2-3 chiffres (code rayon interne) : IGNORE ces chiffres préfixes. Ex: "56AMANDE GRILLE BIO" → "Amandes grillées bio", "91GRAINES COURGES" → "Graines de courge"
2. Ne JAMAIS inventer un nom qui n'est pas suggéré par le texte du ticket. Si tu n'es pas sûr, simplifie le texte original plutôt qu'halluciner.
3. Base-toi toujours sur les mots présents dans la ligne, même abrégés.

ABRÉVIATIONS COURANTES SUR TICKETS FRANÇAIS :
- 1/2 ECR / ECREM / ECREME = demi-écrémé | ECR = écrémé | ENT = entier
- "1/2" seul sans ECR/ECREM = demi (ex: "MAIS 1/2" = maïs demi-épi, PAS demi-écrémé)
- O.F = offre fraîcheur (mention commerciale à ignorer dans le nom)
- BT = bouteille | PLQ = plaquette | BQT = barquette | DOYPACK = poche
- FR / FRAIS / FRAICHE = frais/fraîche | FLEUR / FLEURETTE = fleurette
- BARAT = baratte | CONC / CONCENTRE = concentré | RAPEE = râpée
- MG = matières grasses | BIO = biologique | VRAC = en vrac
- PDP = producteur du pays | HVE = haute valeur environnementale
- N/JARDIN = Notre Jardin (marque) | DELV = Delverde (marque pâtes)
- ALBA = albacore | H.OL = huile d'olive | CON = conserve | H.OLV = huile d'olive vierge
- GAMME / FILIERE / LABEL / VIERGE / FSC = mentions à intégrer ou ignorer selon contexte
- LT = lait | YAO = yaourt | FROMFR = fromage frais
- PZ = Panzani (marque pâtes et conserves) | MUTTI = Mutti (marque tomates)
- OP = offre permanente (mention commerciale à ignorer, comme O.F)
- X3 / X6 / 2X = quantité en pack | 500ML / 25CL / 1L = volume | 250G / 350G = poids
- PORTION = portion | RAPEE = râpée | FONDU = fondu | TRANCHE = tranche

EXEMPLES DE TRADUCTION :
- "56AMANDE GRILLE BIO VRAC" → name: "Amandes grillées bio"
- "LAIT 1/2 ECREM BT 25CL LACTEL" → name: "Lait demi-écrémé", brand: "Lactel"
- "CREME FR.FLEURETTE BIO 25CL" → name: "Crème fraîche fleurette bio"
- "BEURRE BARAT.BIO DOUX PLQ 125G" → name: "Beurre baratte bio doux"
- "1/5THON ALBA.ENT.H.OL.CON.160G" → name: "Thon albacore entier à l'huile d'olive"
- "OEUFS X6 PYRENENES LABEL ROUGE" → name: "Œufs Label Rouge x6"
- "PUR BREBIS FERMIER OSSAU IRATY" → name: "Ossau-Iraty pur brebis fermier"
- "MOZZARELLA RAPEE 22% MG 150G" → name: "Mozzarella râpée"
- "MUTTI CONCENTRE TUBE ZRP 130G" → name: "Concentré de tomate", brand: "Mutti"
- "PZ PULPE FINE OP,800G" → name: "Pulpe de tomates fine", brand: "Panzani"
- "MAIS 1/2 O.F N/JARDIN" → name: "Maïs demi-épi", brand: "Notre Jardin"
- "KNOPPERS MINIS LT-NOISET 200G" → name: "Knoppers Minis lait noisette", brand: "Knoppers"

Pour chaque produit alimentaire retourne :
- name: nom lisible en français (voir exemples ci-dessus)
- brand: marque reconnaissable (Lactel, Mutti, Knoppers, Innocent, Panzani...), null sinon
- quantity: quantité achetée (entier, souvent 1)
- unit_price: prix unitaire en euros (float)
- total_price: prix total de la ligne (float)
- category: une parmi: boisson, laitage, viande, poisson, fruit, légume, épicerie, surgelé, pain, café, autre
- emoji: emoji représentatif

À la racine :
- store: nom du magasin si visible, null sinon
- total: montant total TTC si visible, null sinon

Ignore : hygiène, parfumerie, lessives, journaux, sacs, articles non-alimentaires.

Réponds UNIQUEMENT avec ce JSON valide, sans markdown :
{"store": "...", "total": 0.00, "items": [...]}
Si aucun produit alimentaire : {"store": null, "total": null, "items": []}`,
            },
          ],
        }],
      }),
    })

    const data = await response.json()

    if (data.error || data.type === 'error') {
      console.error('Claude API error:', JSON.stringify(data))
      return new Response(JSON.stringify({ error: data.error?.message ?? 'Claude error', store: null, total: null, items: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const content = data.content?.[0]?.text?.trim() ?? '{}'
    console.log('Claude raw response:', content.slice(0, 300))

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
