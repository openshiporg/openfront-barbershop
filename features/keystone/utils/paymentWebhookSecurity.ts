import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

function signatureDigest(signatureHeader: string) {
  const value = signatureHeader.trim();
  const digest = value.startsWith('sha256=') ? value.slice('sha256='.length) : value;
  return /^[a-f0-9]{64}$/i.test(digest) ? digest.toLowerCase() : null;
}

// The signature is checked over the exact received bytes, never a re-encoded string.
export function verifyHmacSha256Signature(rawBody: Uint8Array, signatureHeader: string, secret: string) {
  if (!rawBody.byteLength || !secret) return false;
  const supplied = signatureDigest(signatureHeader);
  if (!supplied) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(supplied, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function parseSignedJsonWebhook({
  rawBody,
  signature,
  secret,
}: {
  rawBody: Uint8Array;
  signature: string;
  secret: string;
}) {
  if (!verifyHmacSha256Signature(rawBody, signature, secret)) {
    throw new Error('Payment webhook signature is invalid.');
  }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)) as unknown;
}

export function paymentWebhookReplayKey(providerCode: string, providerEventId: string) {
  return createHash('sha256')
    .update(`${providerCode.trim().toLowerCase()}:${providerEventId.trim()}`, 'utf8')
    .digest('hex');
}

export function paymentWebhookPayloadHash(rawBody: Uint8Array) {
  return createHash('sha256').update(rawBody).digest('hex');
}
