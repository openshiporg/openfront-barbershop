import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { createSameOriginMcpFetch } from '../sameOriginMcpFetch';

type CapturedRequest = { url: string; headers: Headers };

function recordingFetch(captured: CapturedRequest[]) {
  return async (input: string | URL, init?: RequestInit) => {
    captured.push({ url: String(input), headers: new Headers(init?.headers) });
    return new Response(null, { status: 204 });
  };
}

test('forwards the request cookie only to the exact MCP endpoint', async () => {
  const captured: CapturedRequest[] = [];
  const scopedFetch = createSameOriginMcpFetch({
    endpoint: new URL('https://barbershop.local/api/mcp-transport/http'),
    cookie: 'keystonejs-session=request-a',
    fetchImpl: recordingFetch(captured),
  });

  await scopedFetch('https://barbershop.local/api/mcp-transport/http', {
    headers: { 'x-request-id': 'same-origin' },
  });
  await scopedFetch('https://barbershop.local/api/graphql');
  await scopedFetch('https://openrouter.ai/api/v1/chat/completions');
  await scopedFetch('https://attacker.example/api/mcp-transport/http');

  assert.equal(captured[0].headers.get('cookie'), 'keystonejs-session=request-a');
  assert.equal(captured[0].headers.get('x-request-id'), 'same-origin');
  assert.equal(captured[1].headers.get('cookie'), null);
  assert.equal(captured[2].headers.get('cookie'), null);
  assert.equal(captured[3].headers.get('cookie'), null);
});

test('does not overwrite a caller cookie on non-MCP requests', async () => {
  const captured: CapturedRequest[] = [];
  const scopedFetch = createSameOriginMcpFetch({
    endpoint: new URL('https://barbershop.local/api/mcp-transport/http'),
    cookie: 'keystonejs-session=request-a',
    fetchImpl: recordingFetch(captured),
  });

  await scopedFetch('https://openrouter.ai/api/v1/models', {
    headers: { cookie: 'provider-cookie=keep-me' },
  });

  assert.equal(captured[0].headers.get('cookie'), 'provider-cookie=keep-me');
});

test('completion route anchors cookie-bearing MCP requests to the configured server origin', () => {
  const wrapper = readFileSync(resolve(process.cwd(), 'app/api/completion/route.ts'), 'utf8');
  assert.match(wrapper, /export \{ POST \} from '@\/features\/platform\/ai\/api\/completion'/);
  const source = readFileSync(resolve(process.cwd(), 'features/platform/ai/api/completion.ts'), 'utf8');

  assert.match(source, /import \{ getBaseUrl \} from ['"]@\/features\/dashboard\/lib\/getBaseUrl['"]/);
  assert.match(source, /new URL\(['"]\/api\/mcp-transport\/http['"], await getBaseUrl\(\)\)/);
  assert.doesNotMatch(source, /new URL\([^)]*,\s*req\.url\s*\)/);
});

test('keeps simultaneous request cookies instance-scoped', async () => {
  const capturedA: CapturedRequest[] = [];
  const capturedB: CapturedRequest[] = [];
  const endpoint = new URL('https://barbershop.local/api/mcp-transport/http');
  const requestA = createSameOriginMcpFetch({
    endpoint,
    cookie: 'keystonejs-session=request-a',
    fetchImpl: recordingFetch(capturedA),
  });
  const requestB = createSameOriginMcpFetch({
    endpoint,
    cookie: 'keystonejs-session=request-b',
    fetchImpl: recordingFetch(capturedB),
  });

  await Promise.all([
    requestA(endpoint),
    requestB(endpoint),
    requestA('https://openrouter.ai/api/v1/chat/completions'),
    requestB('https://openrouter.ai/api/v1/chat/completions'),
  ]);

  assert.equal(capturedA[0].headers.get('cookie'), 'keystonejs-session=request-a');
  assert.equal(capturedB[0].headers.get('cookie'), 'keystonejs-session=request-b');
  assert.equal(capturedA[1].headers.get('cookie'), null);
  assert.equal(capturedB[1].headers.get('cookie'), null);
  assert.equal(globalThis.fetch, fetch);
});
