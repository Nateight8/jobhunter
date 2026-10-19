CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"key" text,
	"question" text NOT NULL,
	"answer_type" text DEFAULT 'text' NOT NULL,
	"answer" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_profile_key_unique" UNIQUE("profile_id","key")
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answers_profile_idx" ON "answers" USING btree ("profile_id","position");