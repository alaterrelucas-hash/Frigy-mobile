import PostHog from 'posthog-react-native';

// Remplace 'POSTHOG_KEY_ICI' par ta clé depuis app.posthog.com > Settings > API Keys
export const posthog = new PostHog('phc_ngoo6BH5PpohFqRxYBXdo5NqumJXWL3KQY5ghg3Xnco6', {
  host: 'https://eu.i.posthog.com', // Serveur Europe (RGPD)
  flushAt: 10,
  flushInterval: 30000,
});
