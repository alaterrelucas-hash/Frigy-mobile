import * as Sentry from '@sentry/react-native';

const DSN = 'https://d042b564c1a28386ab3a1cba9cebec3f@o4511664813047809.ingest.de.sentry.io/4511664821108816';

export function initSentry() {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
    enabled: !__DEV__,
  });
}

export { Sentry };
