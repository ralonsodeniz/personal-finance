CREATE TABLE IF NOT EXISTS "wayfinder_system_health" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "status" text NOT NULL DEFAULT 'ready',
  CONSTRAINT "wayfinder_system_health_singleton" CHECK ("id" = 1)
);
--> statement-breakpoint
INSERT INTO "wayfinder_system_health" ("id", "status")
VALUES (1, 'ready')
ON CONFLICT ("id") DO UPDATE SET "status" = EXCLUDED."status";
