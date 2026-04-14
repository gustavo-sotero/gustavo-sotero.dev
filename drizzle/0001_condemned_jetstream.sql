CREATE TABLE "ai_post_generation_settings" (
	"scope" varchar(32) PRIMARY KEY DEFAULT 'global' NOT NULL,
	"topics_model_id" varchar(255),
	"draft_model_id" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
