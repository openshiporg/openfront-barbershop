import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_PATTERN, accessCookieName, accessCookieOptions, type AccessKind } from "./lib/access-cookie-names";

const TOKEN_LINK_PATHS: Record<string, AccessKind> = { "/appointment": "appointment", "/queue": "queue" };

// The vertical's storefront hook for the shared proxy (as in Openfront Restaurant). Older status links
// carried the access token in the URL: move it into an HttpOnly cookie and drop it from the address.
export async function handleStorefrontRoutes(request: NextRequest, _user: unknown) {
  const kind = TOKEN_LINK_PATHS[request.nextUrl.pathname];
  const id = request.nextUrl.searchParams.get("id") || "";
  const token = request.nextUrl.searchParams.get("token");
  if (!kind || token === null) return NextResponse.next();

  const clean = request.nextUrl.clone();
  clean.searchParams.delete("token");
  const response = NextResponse.redirect(clean);
  const name = accessCookieName(kind, id);
  if (name && ACCESS_TOKEN_PATTERN.test(token)) response.cookies.set(name, token, accessCookieOptions(kind));
  return response;
}
