import { NextRequest, NextResponse } from "next/server";
import { getAuth0Client } from "./lib/auth0";
import { isAppConfigured } from "./lib/env";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const scriptPolicy = process.env.NODE_ENV === "development"
    ? `'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'nonce-${nonce}' 'strict-dynamic'`;
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptPolicy}`,
    "connect-src 'self'",
    process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
  ].filter(Boolean).join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const securedRequest = new NextRequest(request, { headers: requestHeaders });
  const response = isAppConfigured()
    ? await getAuth0Client().middleware(securedRequest)
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|og.png|robots.txt).*)"],
};
