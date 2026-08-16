import { NextResponse } from "next/server";

import { WEB_SESSION_COOKIE_NAME, webSessionCookieOptions } from "../../lib/web-session";

import { createProviderDoubleSessionValue, isProviderDoubleEnabled } from "../../lib/auth-double";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const result = createProviderDoubleSessionValue({
    subject: url.searchParams.get("subject") ?? undefined,
  });

  if (!isProviderDoubleEnabled()) {
    if (result.status === "unavailable" && result.reason !== "provider-double-disabled") {
      return unavailableResponse(503, result.reason);
    }

    return unavailableResponse(404, "provider-double-disabled");
  }

  if (result.status === "unavailable") {
    return unavailableResponse(503, result.reason);
  }

  const response = NextResponse.redirect(new URL("/workspace", request.url), 303);
  response.cookies.set(WEB_SESSION_COOKIE_NAME, result.value, webSessionCookieOptions());
  return response;
}

function unavailableResponse(status: number, reason: string) {
  return new Response(
    JSON.stringify({
      error: "authentication-unavailable",
      reason,
    }),
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json",
      },
      status,
    },
  );
}
