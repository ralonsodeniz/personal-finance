import { systemHealthResponseSchema, type SystemHealthResponse } from "@personal-finance/contracts";
import {
  createSystemHealthDataSource,
  type SystemHealthData,
  type SystemHealthDataSource,
} from "@personal-finance/data-access";

export interface SystemHealthServiceOptions {
  clock?: () => Date;
  dataSource?: SystemHealthDataSource;
}

export interface SystemHealthService {
  getSystemHealth(): Promise<SystemHealthResponse>;
}

function responseFromData(data: SystemHealthData, clock: () => Date): SystemHealthResponse {
  return systemHealthResponseSchema.parse({
    checkedAt: clock().toISOString(),
    contractVersion: "v1",
    data,
    service: "wayfinder",
    status: data.database === "ready" && data.migrations === "ready" ? "ok" : "degraded",
  });
}

export function createSystemHealthService({
  clock = () => new Date(),
  dataSource = createSystemHealthDataSource(),
}: SystemHealthServiceOptions = {}): SystemHealthService {
  return {
    async getSystemHealth() {
      return responseFromData(await dataSource.check(), clock);
    },
  };
}

const defaultSystemHealthService = createSystemHealthService();

export function getSystemHealth(): Promise<SystemHealthResponse> {
  return defaultSystemHealthService.getSystemHealth();
}
