export function runtimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const databaseURL = env.DATABASE_URL || '';
  let url: URL;
  try { url = new URL(databaseURL); } catch { throw new Error('DATABASE_URL must be a configured PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');
  const secret = env.SESSION_SECRET || '';
  if (secret.length < 32 || /this secret should only be used in testing/i.test(secret)) throw new Error('SESSION_SECRET must be a private random value of at least 32 characters.');
  return { databaseURL, sessionConfig: { maxAge: 60 * 60, secret } };
}
