/**
 * Generated from packages/contracts/src/openapi.ts.
 * Do not import server implementation or ORM types into this package.
 */

export interface SystemHealthData {
  database: "ready" | "unavailable";
  migrations: "ready" | "pending" | "unavailable";
  provider: "postgresql" | "provider-double";
}

export interface SystemHealthResponse {
  checkedAt: string;
  contractVersion: "v1";
  data: SystemHealthData;
  service: "wayfinder";
  status: "ok" | "degraded";
}

export interface SystemHealthQuery {
  scope?: "system";
}

export interface ProblemDetailsError {
  code: string;
  message: string;
  path: string;
}

export interface ProblemDetails {
  detail: string;
  errors?: ProblemDetailsError[];
  instance?: string;
  status: number;
  title: string;
  type: string;
}

export interface WayfinderClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  readonly problem: ProblemDetails;
  readonly status: number;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = "ApiError";
    this.problem = problem;
    this.status = problem.status;
  }
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.detail === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.title === "string" &&
    typeof candidate.type === "string"
  );
}

function responseBody(value: unknown, status: number): ProblemDetails {
  if (isProblemDetails(value)) {
    return value;
  }

  return {
    detail: `The API returned an unexpected ${status} response.`,
    status,
    title: "API request failed",
    type: "https://wayfinder.dev/problems/api-request-failed",
  };
}

export function createWayfinderClient(options: WayfinderClientOptions) {
  const request = options.fetch ?? globalThis.fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  return {
    async getSystemHealth(input: SystemHealthQuery = {}): Promise<SystemHealthResponse> {
      const query = new URLSearchParams();
      if (input.scope) {
        query.set("scope", input.scope);
      }

      const queryString = query.toString();
      const url = `${baseUrl}/api/v1/system/health${queryString ? `?${queryString}` : ""}`;
      const response = await request(url, {
        headers: {
          accept: "application/json, application/problem+json",
          ...options.headers,
        },
      });
      const payload = JSON.parse(await response.text()) as unknown;

      if (!response.ok) {
        throw new ApiError(responseBody(payload, response.status));
      }

      return payload as SystemHealthResponse;
    },
  };
}
