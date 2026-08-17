export type ApplicationEnvironmentName = "development" | "preview" | "production";

export interface EnvironmentRecord {
  [key: string]: string | undefined;
}

export interface ResolvedApplicationEnvironment {
  explicit?: string;
  invalid?: string;
  name: ApplicationEnvironmentName;
  vercel?: string;
}

export interface ParsedEnvironmentText {
  entries: EnvironmentRecord;
  errors: string[];
}

export interface EnvironmentBoundaryValidation {
  environment: ResolvedApplicationEnvironment;
  errors: string[];
  ok: boolean;
}

export type EnvironmentOverrides = EnvironmentRecord;

export const APPLICATION_ENVIRONMENTS: readonly ApplicationEnvironmentName[];
export function parseEnvironmentText(contents: string, fileName?: string): ParsedEnvironmentText;
export function resolveApplicationEnvironment(
  environment?: EnvironmentRecord,
): ResolvedApplicationEnvironment;
export function getScopedEnvironment(environment?: EnvironmentRecord): EnvironmentRecord;
export function createPreviewEnvironment(
  environment?: EnvironmentRecord,
  overrides?: EnvironmentOverrides,
): EnvironmentRecord;
export function validateEnvironmentBoundary(
  environment?: EnvironmentRecord,
): EnvironmentBoundaryValidation;
export function scopedEnvironmentKeys(): string[];
