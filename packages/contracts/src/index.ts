import { z, type ZodError } from "zod";

export const systemHealthOpenApiPath = "/system/health" as const;
export const systemHealthApiVersion = "v1" as const;

export const systemHealthQuerySchema = z
  .object({
    scope: z.literal("system").optional(),
  })
  .strict();

export const systemHealthDataSchema = z
  .object({
    database: z.enum(["ready", "unavailable"]),
    migrations: z.enum(["ready", "pending", "unavailable"]),
    provider: z.enum(["postgresql", "provider-double"]),
  })
  .strict();

export const systemHealthResponseSchema = z
  .object({
    checkedAt: z.string().datetime({ offset: true }),
    contractVersion: z.literal(systemHealthApiVersion),
    data: systemHealthDataSchema,
    service: z.literal("wayfinder"),
    status: z.enum(["ok", "degraded"]),
  })
  .strict();

export const problemDetailsErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    path: z.string().min(1),
  })
  .strict();

export const problemDetailsSchema = z
  .object({
    detail: z.string().min(1),
    errors: z.array(problemDetailsErrorSchema).optional(),
    instance: z.string().min(1).optional(),
    status: z.number().int().min(400).max(599),
    title: z.string().min(1),
    type: z.string().url(),
  })
  .strict();

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
export type SystemHealthData = z.infer<typeof systemHealthDataSchema>;
export type SystemHealthQuery = z.infer<typeof systemHealthQuerySchema>;
export type SystemHealthResponse = z.infer<typeof systemHealthResponseSchema>;

export interface ProblemDetailsInput {
  detail: string;
  errors?: ProblemDetails["errors"];
  instance?: string;
  status: number;
  title: string;
  type: string;
}

export function createProblemDetails(input: ProblemDetailsInput): ProblemDetails {
  return problemDetailsSchema.parse(input);
}

export function problemDetailsFromZodError(error: ZodError, instance?: string): ProblemDetails {
  return createProblemDetails({
    detail: "One or more request values are invalid.",
    errors: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.length > 0 ? issue.path.join(".") : "$",
    })),
    instance,
    status: 400,
    title: "Invalid request",
    type: "https://wayfinder.dev/problems/invalid-request",
  });
}
