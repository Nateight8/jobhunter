ALTER TABLE "companies" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "fail_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "last_scraped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "open_jobs" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "last_error" text;