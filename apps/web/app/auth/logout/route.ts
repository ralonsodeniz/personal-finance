import { NextResponse } from "next/server";

import { WEB_SESSION_COOKIE_NAME, webSessionCookieOptions } from "../../lib/web-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): Response {
  const response = NextResponse.redirect(new URL("/workspace", request.url), 303);
  response.cookies.set(WEB_SESSION_COOKIE_NAME, "", {
    ...webSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
