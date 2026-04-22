ALTER TABLE "experience" ADD COLUMN "impact_facts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "impact_facts" jsonb DEFAULT '[]'::jsonb NOT NULL;