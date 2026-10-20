CREATE TABLE "apply_run_files" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"mime_type" text NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apply_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"message" text,
	"report" jsonb,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apply_run_files" ADD CONSTRAINT "apply_run_files_run_id_apply_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."apply_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply_runs" ADD CONSTRAINT "apply_runs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apply_runs" ADD CONSTRAINT "apply_runs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apply_runs_job_idx" ON "apply_runs" USING btree ("profile_id","job_id","created_at");--> statement-breakpoint
CREATE INDEX "apply_runs_status_idx" ON "apply_runs" USING btree ("status");