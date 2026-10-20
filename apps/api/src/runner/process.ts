import { and, eq } from "drizzle-orm";
import type { Page } from "playwright";
import { applyRunFiles, documents, jobs, profiles, type ApplyRun } from "@workspace/db";
import { db } from "../lib/db";
import { setApplicationStatus } from "../modules/applications/applications.service";
import { getDocumentFile } from "../modules/documents/documents.service";
import { getJobForm } from "../modules/forms/forms.service";
import { getContext } from "./browser";
import { log, setStatus, sleep } from "./db";
import { detectSubmission, fillGreenhouse, inspectControls, openForm } from "./fill-greenhouse";

const WATCH_MS = 45 * 60_000;

/** Opens the form and fills it. The user reviews and presses Submit; this never does. */
export async function processRun(run: ApplyRun): Promise<void> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, run.profileId));
  const [job] = await db.select().from(jobs).where(eq(jobs.id, run.jobId));
  if (!profile || !job) throw new Error("The job or profile no longer exists.");

  const split = job.sourceId.indexOf(":");
  const slug = job.sourceId.slice(0, split);
  const greenhouseId = job.sourceId.slice(split + 1);

  await log(run.id, "Reading the application questions…");
  const form = await getJobForm(db, profile, job.id, true);

  const [cvDoc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.profileId, profile.id), eq(documents.kind, "cv"), eq(documents.isDefault, true)))
    .limit(1);
  const file = cvDoc ? await getDocumentFile(db, cvDoc.id) : null;

  await log(run.id, "Opening the browser…");
  const context = await getContext();
  const page = await context.newPage();

  const root = await openForm(page, slug, greenhouseId, job.url);
  if (!root) {
    await setStatus(
      run.id,
      "failed",
      "Couldn't find the application form. The posting may be closed, or it uses a page this runner can't read yet. The page is open in the browser if you want to apply by hand.",
    );
    return;
  }

  if (process.env.RUNNER_INSPECT === "1") {
    await log(run.id, `controls: ${await inspectControls(root)}`);
  }

  await setStatus(run.id, "filling", "Filling the form…");
  await log(run.id, "Filling the form…");
  const outcomes = await fillGreenhouse(root, {
    fullName: profile.fullName ?? "",
    email: profile.email ?? "",
    phone: profile.phone,
    cv: file ? { name: file.filename, mimeType: file.mimeType, buffer: file.content } : null,
    form,
  });
  await page.bringToFront().catch(() => undefined);

  const filled = outcomes.filter((o) => o.state === "filled").length;
  const check = outcomes.filter((o) => o.state === "check");
  const needs = outcomes.filter((o) => o.required && (o.state === "left" || o.state === "failed"));
  let message = `Filled ${filled} ${filled === 1 ? "field" : "fields"}.`;
  if (check.length) message += ` Check: ${check.map((o) => o.label).join(", ")}.`;
  if (needs.length) message += ` Still needs you: ${needs.map((o) => o.label).join(", ")}.`;
  message += " Review the browser window, complete anything highlighted, then press Submit there yourself.";

  await setStatus(run.id, "needs_you", message, { outcomes });
  await log(run.id, "Ready for you. Watching for the submission…");

  // Watching runs in the background, so the next queued job can start filling meanwhile.
  void watch(run, page, profile.id, job.id).catch((e) => console.error("watch failed:", e));
}

async function watch(run: ApplyRun, page: Page, profileId: string, jobId: string): Promise<void> {
  const deadline = Date.now() + WATCH_MS;
  while (Date.now() < deadline) {
    if (page.isClosed()) {
      await setStatus(run.id, "closed", "The window was closed before the application was submitted.");
      await log(run.id, "Window closed.");
      return;
    }
    if (await detectSubmission(page)) {
      await sleep(1200); // let the confirmation finish rendering
      const png = await page.screenshot({ fullPage: true, type: "png" }).catch(() => null);
      if (png) {
        await db
          .insert(applyRunFiles)
          .values({ runId: run.id, mimeType: "image/png", content: png })
          .onConflictDoNothing();
      }
      await setApplicationStatus(db, profileId, jobId, "applied");
      await setStatus(
        run.id,
        "submitted",
        png
          ? "Submitted. The confirmation page was captured and the job is marked as applied."
          : "Submitted, and the job is marked as applied. The confirmation screenshot couldn't be captured.",
      );
      await log(run.id, "Submission detected.");
      return;
    }
    await sleep(1000);
  }
  await setStatus(run.id, "abandoned", "Stopped watching after 45 minutes. If you submitted, mark the job as applied yourself.");
}
