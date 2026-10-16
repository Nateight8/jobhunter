CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"ats_type" text,
	"ats_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_domain_unique" UNIQUE("domain"),
	CONSTRAINT "companies_ats_unique" UNIQUE("ats_type","ats_slug")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"url" text NOT NULL,
	"apply_url" text,
	"title" text NOT NULL,
	"company_name" text NOT NULL,
	"company_id" uuid,
	"location" text,
	"remote_type" text DEFAULT 'unknown' NOT NULL,
	"description" text,
	"salary_min" bigint,
	"salary_max" bigint,
	"salary_currency" text,
	"salary_period" text,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"dedupe_key" text NOT NULL,
	"status" text DEFAULT 'unverified' NOT NULL,
	"score" integer,
	"raw" jsonb,
	CONSTRAINT "jobs_source_unique" UNIQUE("source","source_id")
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"jobs_seen" integer DEFAULT 0 NOT NULL,
	"jobs_new" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_dedupe_key_idx" ON "jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "jobs_company_id_idx" ON "jobs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_last_seen_idx" ON "jobs" USING btree ("last_seen_at");