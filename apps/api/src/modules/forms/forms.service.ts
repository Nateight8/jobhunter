import { and, eq } from "drizzle-orm";
import { jobAnswers, jobForms, jobs, type Answer, type JobAnswer, type Profile } from "@workspace/db";
import type { Db } from "../../lib/db";
import { ValidationError } from "../../lib/errors";
import { isUuid } from "../../lib/pagination";
import { requiredStr } from "../../lib/validate";
import { listMemory, normalizeQuestion, saveMemoryEntry } from "../memory/memory.service";
import {
  fetchGreenhouseForm,
  type FormFileData,
  type FormQuestionData,
  type ParsedForm,
} from "./forms.greenhouse";

const CACHE_MS = 12 * 60 * 60 * 1000;

export type Resolution = {
  source: "profile" | "job_answer" | "memory" | "none";
  value: string | null;
};
export type ResolvedQuestion = FormQuestionData & { resolution: Resolution };
export type JobFormView = {
  jobId: string;
  supported: boolean;
  reason: string | null;
  fetchedAt: Date | null;
  files: FormFileData[];
  hasSurvey: boolean;
  questions: ResolvedQuestion[];
};

const NONE: Resolution = { source: "none", value: null };

function matchOption(options: string[], value: string): string | null {
  const v = value.trim().toLowerCase();
  return options.find((o) => o.trim().toLowerCase() === v) ?? null;
}

function profileValue(q: FormQuestionData, p: Profile): string | null {
  if (q.kind !== "text" && q.kind !== "textarea") return null;
  const l = q.label.toLowerCase();
  if (q.key === "location") return [p.city, p.country].filter(Boolean).join(", ") || null;
  if (/linked\s?in/.test(l)) return p.linkedinUrl;
  if (/github/.test(l)) return p.githubUrl;
  if (/(portfolio|personal\s+(web)?site|\bwebsite\b)/.test(l)) return p.portfolioUrl;
  return null;
}

// Order: your answer for this job, then your profile, then memory. Anything doubtful stays blank.
function resolve(
  q: FormQuestionData,
  ctx: { profile: Profile; saved: Map<string, JobAnswer>; memory: Answer[] },
): Resolution {
  if (q.kind === "multiselect" || q.kind === "unsupported") return NONE;

  const saved = ctx.saved.get(q.key);
  if (saved && saved.status === "accepted") {
    const value = q.kind === "select" ? matchOption(q.options, saved.answer) : saved.answer;
    if (value) return { source: "job_answer", value };
  }

  const fromProfile = profileValue(q, ctx.profile);
  if (fromProfile) return { source: "profile", value: fromProfile };

  const norm = normalizeQuestion(q.label);
  const entry = ctx.memory.find((m) => normalizeQuestion(m.question) === norm);
  if (entry?.answer) {
    const value = q.kind === "select" ? matchOption(q.options, entry.answer) : entry.answer;
    if (value) return { source: "memory", value };
  }
  return NONE;
}

async function loadForm(
  db: Db,
  job: { id: string; sourceId: string },
  refresh: boolean,
): Promise<{ form: ParsedForm | null; fetchedAt: Date | null; reason: string | null }> {
  const [cached] = await db.select().from(jobForms).where(eq(jobForms.jobId, job.id));
  if (cached && !refresh && Date.now() - cached.fetchedAt.getTime() < CACHE_MS) {
    return { form: cached.form as ParsedForm, fetchedAt: cached.fetchedAt, reason: null };
  }
  try {
    const res = await fetchGreenhouseForm(job.sourceId);
    if (res.status === "gone") {
      return { form: null, fetchedAt: null, reason: "This posting is no longer on Greenhouse." };
    }
    const fetchedAt = new Date();
    await db
      .insert(jobForms)
      .values({ jobId: job.id, form: res.form, fetchedAt })
      .onConflictDoUpdate({ target: jobForms.jobId, set: { form: res.form, fetchedAt } });
    return { form: res.form, fetchedAt, reason: null };
  } catch (e) {
    console.error("greenhouse form fetch failed:", (e as Error).message);
    if (cached) {
      return {
        form: cached.form as ParsedForm,
        fetchedAt: cached.fetchedAt,
        reason: "Couldn't refresh the questions, showing the last saved copy.",
      };
    }
    return { form: null, fetchedAt: null, reason: "Couldn't reach Greenhouse. Try again in a moment." };
  }
}

export async function getJobForm(
  db: Db,
  profile: Profile,
  jobId: string,
  refresh = false,
): Promise<JobFormView> {
  if (!isUuid(jobId)) throw new ValidationError("Job not found");
  const [job] = await db
    .select({ id: jobs.id, source: jobs.source, sourceId: jobs.sourceId })
    .from(jobs)
    .where(eq(jobs.id, jobId));
  if (!job) throw new ValidationError("Job not found");

  const empty = { jobId, files: [], hasSurvey: false, questions: [] as ResolvedQuestion[] };
  if (job.source !== "greenhouse") {
    return {
      ...empty,
      supported: false,
      reason: "Application questions are only available for Greenhouse jobs so far.",
      fetchedAt: null,
    };
  }

  const { form, fetchedAt, reason } = await loadForm(db, job, refresh);
  if (!form) return { ...empty, supported: true, reason, fetchedAt };

  const [savedRows, memory] = await Promise.all([
    db
      .select()
      .from(jobAnswers)
      .where(and(eq(jobAnswers.profileId, profile.id), eq(jobAnswers.jobId, jobId))),
    listMemory(db, profile.id),
  ]);
  const ctx = { profile, saved: new Map(savedRows.map((r) => [r.fieldName, r])), memory };

  return {
    jobId,
    supported: true,
    reason,
    fetchedAt,
    files: form.files,
    hasSurvey: form.hasSurvey,
    questions: form.questions.map((q) => ({ ...q, resolution: resolve(q, ctx) })),
  };
}

export async function saveJobAnswer(
  db: Db,
  profile: Profile,
  jobId: string,
  input: { key: string; answer: string; remember: boolean },
): Promise<JobFormView> {
  const view = await getJobForm(db, profile, jobId);
  const q = view.questions.find((x) => x.key === input.key);
  if (!q) throw new ValidationError("That question isn't on this form");
  if (q.kind !== "text" && q.kind !== "textarea" && q.kind !== "select") {
    throw new ValidationError("Answer this one on the employer's form");
  }

  let answer = requiredStr("answer", input.answer, 4000);
  if (q.kind === "select") {
    const option = matchOption(q.options, answer);
    if (!option) throw new ValidationError("Pick one of the listed options");
    answer = option;
  }

  if (input.remember) {
    if (answer.length > 2000) throw new ValidationError("Too long to remember. Save it for this job only.");
    const yesNo = q.options.length === 2 && q.options.every((o) => ["yes", "no"].includes(o.toLowerCase()));
    await saveMemoryEntry(db, profile.id, {
      question: q.label,
      answerType: yesNo ? "yesno" : "text",
      answer,
    });
  }

  await db
    .insert(jobAnswers)
    .values({ profileId: profile.id, jobId, fieldName: q.key, label: q.label, answer, source: "you", status: "accepted" })
    .onConflictDoUpdate({
      target: [jobAnswers.profileId, jobAnswers.jobId, jobAnswers.fieldName],
      set: { label: q.label, answer, source: "you", status: "accepted", updatedAt: new Date() },
    });

  return getJobForm(db, profile, jobId);
}

export async function clearJobAnswer(
  db: Db,
  profile: Profile,
  jobId: string,
  key: string,
): Promise<JobFormView> {
  if (!isUuid(jobId)) throw new ValidationError("Job not found");
  await db
    .delete(jobAnswers)
    .where(
      and(eq(jobAnswers.profileId, profile.id), eq(jobAnswers.jobId, jobId), eq(jobAnswers.fieldName, key)),
    );
  return getJobForm(db, profile, jobId);
}
