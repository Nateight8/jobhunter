ALTER TABLE "jobs" ADD COLUMN "regions" text[];--> statement-breakpoint
CREATE INDEX "jobs_regions_idx" ON "jobs" USING gin ("regions");