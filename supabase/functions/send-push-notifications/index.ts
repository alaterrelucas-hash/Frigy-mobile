import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Récupère tous les items qui expirent dans 0, 1 ou 3 jours
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: items } = await supabase
      .from('items')
      .select('id, name, emoji, days_left, family_id')
      .eq('consumed', false)
      .gte('days_left', 0)
      .lte('days_left', 3);

    if (!items?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

    // Groupe par family_id
    const byFamily: Record<string, typeof items> = {};
    for (const item of items) {
      if (!byFamily[item.family_id]) byFamily[item.family_id] = [];
      byFamily[item.family_id].push(item);
    }

    const familyIds = Object.keys(byFamily);

    // Récupère les tokens et prefs des profils concernés
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, family_id, push_token, notification_prefs')
      .in('family_id', familyIds)
      .not('push_token', 'is', null);

    if (!profiles?.length) return new Response(JSON.stringify({ sent: 0, reason: 'no tokens' }), { status: 200 });

    const messages = [];

    for (const profile of profiles) {
      const prefs = profile.notification_prefs || {};
      if (prefs.pushEnabled === false || prefs.expirationAlerts === false) continue;

      const familyItems = byFamily[profile.family_id] || [];
      const urgent = familyItems
        .sort((a, b) => a.days_left - b.days_left)
        .slice(0, 3);

      if (!urgent.length) continue;

      const topItem = urgent[0];
      const when = topItem.days_left === 0 ? "aujourd'hui"
        : topItem.days_left === 1 ? 'demain'
        : `dans ${topItem.days_left} jours`;

      const extraCount = urgent.length - 1;
      const body = extraCount > 0
        ? `${topItem.emoji} ${topItem.name} expire ${when} (+${extraCount} autre${extraCount > 1 ? 's' : ''})`
        : `${topItem.emoji} ${topItem.name} expire ${when}`;

      const recipeHint = prefs.recipeSuggestions !== false ? ' 👨‍🍳' : '';

      messages.push({
        to: profile.push_token,
        title: '🛒 Frigy — Produits à consommer',
        body: body + recipeHint,
        sound: 'default',
        data: { screen: 'fridge' },
      });
    }

    if (!messages.length) return new Response(JSON.stringify({ sent: 0, reason: 'all opted out' }), { status: 200 });

    // Envoie par batches de 100 (limite Expo)
    const BATCH = 100;
    let sent = 0;
    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH);
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(batch),
      });
      sent += batch.length;
    }

    return new Response(JSON.stringify({ sent }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
