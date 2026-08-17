export type JobStatus = "queued" | "leased" | "retrying" | "dead-letter";

export interface JobEnvelope<JobType extends string = string, Payload = unknown> {
  availableAt: Date;
  idempotencyKey: string;
  jobType: JobType;
  payload: Payload;
  releaseVersion: string;
}

export interface LeasedJob<JobType extends string = string, Payload = unknown> extends JobEnvelope<
  JobType,
  Payload
> {
  attempt: number;
  id: string;
  leasedUntil: Date;
  status: "leased";
}

export interface JobFailure {
  errorClass: string;
  retryAt?: Date;
}

export interface JobQueue {
  complete(jobId: string): Promise<void>;
  enqueue<JobType extends string, Payload>(
    job: JobEnvelope<JobType, Payload>,
  ): Promise<{ id: string }>;
  fail(jobId: string, failure: JobFailure): Promise<void>;
  lease(options?: { limit?: number; now?: Date }): Promise<readonly LeasedJob[]>;
}

export interface Scheduler {
  schedule(options?: { at?: Date }): Promise<void>;
}

export interface JobQueueAdapter {
  provider: "free-tier-supabase" | "paid-worker";
  queue: JobQueue;
  scheduler: Scheduler;
}

export const FREE_TIER_JOB_POLICY = {
  consumer: "short-lived Edge Function batches",
  durableStore: "Supabase Queues (pgmq)",
  maxBatchDurationSeconds: 30,
  scheduler: "Supabase Cron",
  usesAlwaysOnWorker: false,
} as const;

export const PAID_WORKER_MIGRATION_BOUNDARY = {
  adapter: "JobQueueAdapter",
  migrationTriggers: [
    "job duration or memory exceeds the bounded consumer",
    "continuous consumption is required",
    "queue throughput or retry operations exceed the free-tier path",
  ],
  targets: ["Render background worker", "Cloudflare Queues", "Amazon SQS"],
} as const;
