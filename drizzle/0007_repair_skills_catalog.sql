-- Repairs drifted databases that recorded 0005_add_skills without all skill objects.
DO $$
BEGIN
	CREATE TYPE "public"."skill_category" AS ENUM('language', 'framework', 'tool', 'db', 'cloud', 'infra');
EXCEPTION
	WHEN duplicate_object THEN null;
END
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"category" "skill_category" NOT NULL,
	"icon_key" varchar(100),
	"expertise_level" smallint DEFAULT 1 NOT NULL,
	"is_highlighted" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name"),
	CONSTRAINT "skills_slug_unique" UNIQUE("slug"),
	CONSTRAINT "skills_expertise_level_check" CHECK ("skills"."expertise_level" >= 1 AND "skills"."expertise_level" <= 3),
	CONSTRAINT "skills_is_highlighted_check" CHECK ("skills"."is_highlighted" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_skills" (
	"project_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	CONSTRAINT "project_skills_project_id_skill_id_pk" PRIMARY KEY("project_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "experience_skills" (
	"experience_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	CONSTRAINT "experience_skills_experience_id_skill_id_pk" PRIMARY KEY("experience_id","skill_id")
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'skills_pkey'
			AND conrelid = 'public.skills'::regclass
	) THEN
		IF EXISTS (
			SELECT 1
			FROM pg_class index_rel
			JOIN pg_namespace n ON n.oid = index_rel.relnamespace
			WHERE index_rel.relkind = 'i'
				AND n.nspname = 'public'
				AND index_rel.relname = 'skills_pkey'
		) THEN
			ALTER TABLE "skills" ADD CONSTRAINT "skills_pkey" PRIMARY KEY USING INDEX "skills_pkey";
		ELSE
			ALTER TABLE "skills" ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("id");
		END IF;
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'project_skills_project_id_skill_id_pk'
			AND conrelid = 'public.project_skills'::regclass
	) THEN
		IF EXISTS (
			SELECT 1
			FROM pg_class index_rel
			JOIN pg_namespace n ON n.oid = index_rel.relnamespace
			WHERE index_rel.relkind = 'i'
				AND n.nspname = 'public'
				AND index_rel.relname = 'project_skills_project_id_skill_id_pk'
		) THEN
			ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_project_id_skill_id_pk"
				PRIMARY KEY USING INDEX "project_skills_project_id_skill_id_pk";
		ELSE
			ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_project_id_skill_id_pk"
				PRIMARY KEY ("project_id", "skill_id");
		END IF;
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'experience_skills_experience_id_skill_id_pk'
			AND conrelid = 'public.experience_skills'::regclass
	) THEN
		IF EXISTS (
			SELECT 1
			FROM pg_class index_rel
			JOIN pg_namespace n ON n.oid = index_rel.relnamespace
			WHERE index_rel.relkind = 'i'
				AND n.nspname = 'public'
				AND index_rel.relname = 'experience_skills_experience_id_skill_id_pk'
		) THEN
			ALTER TABLE "experience_skills" ADD CONSTRAINT "experience_skills_experience_id_skill_id_pk"
				PRIMARY KEY USING INDEX "experience_skills_experience_id_skill_id_pk";
		ELSE
			ALTER TABLE "experience_skills" ADD CONSTRAINT "experience_skills_experience_id_skill_id_pk"
				PRIMARY KEY ("experience_id", "skill_id");
		END IF;
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'skills_name_unique'
			AND conrelid = 'public.skills'::regclass
	) THEN
		IF EXISTS (
			SELECT 1
			FROM pg_class index_rel
			JOIN pg_namespace n ON n.oid = index_rel.relnamespace
			WHERE index_rel.relkind = 'i'
				AND n.nspname = 'public'
				AND index_rel.relname = 'skills_name_unique'
		) THEN
			ALTER TABLE "skills" ADD CONSTRAINT "skills_name_unique" UNIQUE USING INDEX "skills_name_unique";
		ELSE
			ALTER TABLE "skills" ADD CONSTRAINT "skills_name_unique" UNIQUE("name");
		END IF;
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'skills_slug_unique'
			AND conrelid = 'public.skills'::regclass
	) THEN
		IF EXISTS (
			SELECT 1
			FROM pg_class index_rel
			JOIN pg_namespace n ON n.oid = index_rel.relnamespace
			WHERE index_rel.relkind = 'i'
				AND n.nspname = 'public'
				AND index_rel.relname = 'skills_slug_unique'
		) THEN
			ALTER TABLE "skills" ADD CONSTRAINT "skills_slug_unique" UNIQUE USING INDEX "skills_slug_unique";
		ELSE
			ALTER TABLE "skills" ADD CONSTRAINT "skills_slug_unique" UNIQUE("slug");
		END IF;
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'skills_expertise_level_check'
			AND conrelid = 'public.skills'::regclass
	) THEN
		ALTER TABLE "skills" ADD CONSTRAINT "skills_expertise_level_check"
			CHECK ("skills"."expertise_level" >= 1 AND "skills"."expertise_level" <= 3);
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'skills_is_highlighted_check'
			AND conrelid = 'public.skills'::regclass
	) THEN
		ALTER TABLE "skills" ADD CONSTRAINT "skills_is_highlighted_check"
			CHECK ("skills"."is_highlighted" IN (0, 1));
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'project_skills_project_id_projects_id_fk'
			AND conrelid = 'public.project_skills'::regclass
	) THEN
		ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_project_id_projects_id_fk"
			FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'project_skills_skill_id_skills_id_fk'
			AND conrelid = 'public.project_skills'::regclass
	) THEN
		ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_skill_id_skills_id_fk"
			FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'experience_skills_experience_id_experience_id_fk'
			AND conrelid = 'public.experience_skills'::regclass
	) THEN
		ALTER TABLE "experience_skills" ADD CONSTRAINT "experience_skills_experience_id_experience_id_fk"
			FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'experience_skills_skill_id_skills_id_fk'
			AND conrelid = 'public.experience_skills'::regclass
	) THEN
		ALTER TABLE "experience_skills" ADD CONSTRAINT "experience_skills_skill_id_skills_id_fk"
			FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skills_category_idx" ON "skills" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skills_is_highlighted_idx" ON "skills" USING btree ("is_highlighted");