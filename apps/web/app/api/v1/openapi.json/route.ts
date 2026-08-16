import { systemHealthOpenApi } from "@personal-finance/contracts/openapi";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(JSON.stringify(systemHealthOpenApi), {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "application/json",
    },
    status: 200,
  });
}
