import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

export function hashPublicAccessToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createPublicAccessToken() {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, hash: hashPublicAccessToken(token) };
}

export function publicAccessTokenMatches(token: string | null | undefined, expectedHash: string | null | undefined) {
  if (!token || !expectedHash) return false;

  const supplied = Buffer.from(hashPublicAccessToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
