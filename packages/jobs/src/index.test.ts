import { describe, expect, it } from "vitest";

import { FREE_TIER_JOB_POLICY, PAID_WORKER_MIGRATION_BOUNDARY } from "./index.js";

describe("portable job delivery boundary", () => {
  it("keeps the initial delivery path free-tier-first and bounded", () => {
    expect(FREE_TIER_JOB_POLICY).toMatchObject({
      durableStore: "Supabase Queues (pgmq)",
      maxBatchDurationSeconds: 30,
      scheduler: "Supabase Cron",
      usesAlwaysOnWorker: false,
    });
  });

  it("moves only the adapter when the paid worker boundary is reached", () => {
    expect(PAID_WORKER_MIGRATION_BOUNDARY).toMatchObject({
      adapter: "JobQueueAdapter",
      targets: expect.arrayContaining(["Render background worker", "Amazon SQS"]),
    });
    expect(PAID_WORKER_MIGRATION_BOUNDARY.migrationTriggers).toHaveLength(3);
  });
});
