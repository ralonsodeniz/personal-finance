import { getSystemHealth } from "@personal-finance/application";
import {
  createProblemDetails,
  problemDetailsFromZodError,
  systemHealthQuerySchema,
  systemHealthResponseSchema,
} from "@personal-finance/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const problemContentType = "application/problem+json";

function problemResponse(
  problem: ReturnType<typeof createProblemDetails>,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(problem), {
    headers: {
      "cache-control": "no-store",
      "content-type": problemContentType,
      ...headers,
    },
    status: problem.status,
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsedQuery = systemHealthQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );

  if (!parsedQuery.success) {
    return problemResponse(problemDetailsFromZodError(parsedQuery.error, url.pathname));
  }

  const response = systemHealthResponseSchema.parse(await getSystemHealth());

  return new Response(JSON.stringify(response), {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json",
    },
    status: 200,
  });
}

export function POST(): Response {
  return problemResponse(
    createProblemDetails({
      detail: "Use GET to read system health.",
      status: 405,
      title: "Method not allowed",
      type: "https://wayfinder.dev/problems/method-not-allowed",
    }),
    { allow: "GET" },
  );
}
