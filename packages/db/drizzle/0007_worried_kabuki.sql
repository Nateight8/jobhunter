CREATE TABLE "job_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"label" text NOT NULL,
	"answer" text NOT NULL,
	"source" text DEFAULT 'you' NOT NULL,
	"status" text DEFAULT 'accepted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_answers_unique" UNIQUE("profile_id","job_id","field_name")
);
--> statement-breakpoint
CREATE TABLE "job_forms" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"form" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_answers" ADD CONSTRAINT "job_answers_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_answers" ADD CONSTRAINT "job_answers_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_forms" ADD CONSTRAINT "job_forms_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_answers_job_idx" ON "job_answers" USING btree ("profile_id","job_id");