CREATE TYPE "public"."ai_post_draft_run_status" AS ENUM('queued', 'running', 'validating', 'completed', 'failed', 'timed_out');--> statement-breakpoint
CREATE TABLE "ai_post_generation_draft_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "ai_post_draft_run_status" DEFAULT 'queued' NOT NULL,
	"stage" varchar(64) DEFAULT 'queued' NOT NULL,
	"requested_category" varchar(128) NOT NULL,
	"concrete_category" varchar(128),
	"request_payload" jsonb NOT NULL,
	"model_id" varchar(255),
	"result_payload" jsonb,
	"error_kind" varchar(64),
	"error_code" varchar(128),
	"error_message" text,
	"provider_generation_id" varchar(255),
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ai_draft_runs_status_created" ON "ai_post_generation_draft_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_draft_runs_created_by_created" ON "ai_post_generation_draft_runs" USING btree ("created_by","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_draft_runs_created_at" ON "ai_post_generation_draft_runs" USING btree ("created_at");