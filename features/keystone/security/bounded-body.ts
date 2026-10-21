import type { Readable } from 'node:stream';

export class BoundedBodyError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

/** Drain rejected Node input without destroying Yoga/Next's request adapter.
 * Cancelling that adapter's Web stream can otherwise create an unhandled
 * AbortError after a correctly rejected oversized request.
 */
export function boundedNodeJson(request: Readable, maxBytes = 1_048_576): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    let chunks: Buffer[] = [];
    const fail = (error: BoundedBodyError) => {
      if (settled) return;
      settled = true; chunks = []; reject(error);
    };
    request.on('data', (chunk: Buffer | string) => {
      if (settled) return; // Continue draining, never retain the rejected tail.
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) { fail(new BoundedBodyError('Request body exceeds 1 MiB', 413)); return; }
      chunks.push(bytes);
    });
    request.once('aborted', () => fail(new BoundedBodyError('Request body was interrupted')));
    request.once('error', () => fail(new BoundedBodyError('Request body was interrupted')));
    request.once('end', () => {
      if (settled) return;
      try {
        const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
        settled = true; chunks = []; resolve(body as Record<string, unknown>);
      } catch { fail(new BoundedBodyError('Invalid GraphQL request body')); }
    });
  });
}

export async function boundedRequestText(request: Request, maxBytes: number): Promise<string> {
  return Buffer.from(await boundedRequestBytes(request, maxBytes)).toString('utf8');
}

/** Reads at most maxBytes and returns the exact received bytes. */
export async function boundedRequestBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const reader = request.body?.getReader();
  if (!reader) throw new BoundedBodyError('Request body is required');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new BoundedBodyError('Request body exceeds the supported limit', 413);
      chunks.push(value);
    }
    return new Uint8Array(Buffer.concat(chunks));
  } finally { reader.releaseLock(); }
}
