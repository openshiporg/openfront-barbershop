type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

function exactEndpointMatches(input: string | URL, endpoint: URL) {
  const target = new URL(String(input), endpoint);
  return target.origin === endpoint.origin
    && target.pathname === endpoint.pathname
    && target.search === endpoint.search;
}

export function createSameOriginMcpFetch({
  endpoint,
  cookie,
  fetchImpl = globalThis.fetch.bind(globalThis),
}: {
  endpoint: URL;
  cookie?: string | null;
  fetchImpl?: FetchLike;
}): FetchLike {
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('The MCP endpoint must use HTTP or HTTPS.');
  }

  const requestCookie = cookie?.trim() || '';

  return async (input, init) => {
    if (!requestCookie || !exactEndpointMatches(input, endpoint)) {
      return fetchImpl(input, init);
    }

    const headers = new Headers(init?.headers);
    headers.set('cookie', requestCookie);
    return fetchImpl(input, { ...init, headers });
  };
}
