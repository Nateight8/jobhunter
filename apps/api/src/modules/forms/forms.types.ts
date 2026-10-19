import { builder } from "../../builder";
import type { FormFileData } from "./forms.greenhouse";
import type { JobFormView, ResolvedQuestion } from "./forms.service";

const FormQuestionKind = builder.enumType("FormQuestionKind", {
  values: {
    TEXT: { value: "text" },
    TEXTAREA: { value: "textarea" },
    SELECT: { value: "select" },
    MULTISELECT: { value: "multiselect" },
    UNSUPPORTED: { value: "unsupported" },
  } as const,
});

const ResolutionSource = builder.enumType("ResolutionSource", {
  values: {
    PROFILE: { value: "profile" },
    JOB_ANSWER: { value: "job_answer" },
    MEMORY: { value: "memory" },
    NONE: { value: "none" },
  } as const,
});

const ResolutionRef = builder.objectRef<ResolvedQuestion["resolution"]>("AnswerResolution");
ResolutionRef.implement({
  description: "Where a question's answer would come from. NONE means it stays blank for the user.",
  fields: (t) => ({
    source: t.field({ type: ResolutionSource, resolve: (r) => r.source }),
    value: t.exposeString("value", { nullable: true }),
  }),
});

const FormQuestionRef = builder.objectRef<ResolvedQuestion>("FormQuestion");
FormQuestionRef.implement({
  fields: (t) => ({
    key: t.exposeString("key"),
    label: t.exposeString("label"),
    required: t.exposeBoolean("required"),
    description: t.exposeString("description", { nullable: true }),
    kind: t.field({ type: FormQuestionKind, resolve: (q) => q.kind }),
    options: t.exposeStringList("options"),
    resolution: t.field({ type: ResolutionRef, resolve: (q) => q.resolution }),
  }),
});

const FormFileRef = builder.objectRef<FormFileData>("FormFile");
FormFileRef.implement({
  fields: (t) => ({
    key: t.exposeString("key"),
    label: t.exposeString("label"),
    required: t.exposeBoolean("required"),
  }),
});

export const JobFormRef = builder.objectRef<JobFormView>("JobForm");
JobFormRef.implement({
  description: "A posting's application form, fetched on demand. Public data plus how each answer would be filled.",
  fields: (t) => ({
    id: t.id({ resolve: (f) => f.jobId }),
    supported: t.exposeBoolean("supported"),
    reason: t.exposeString("reason", { nullable: true }),
    fetchedAt: t.string({ nullable: true, resolve: (f) => f.fetchedAt?.toISOString() ?? null }),
    files: t.field({ type: [FormFileRef], resolve: (f) => f.files }),
    hasSurvey: t.exposeBoolean("hasSurvey", {
      description: "Optional demographic or EEOC questions exist. They are never filled automatically.",
    }),
    questions: t.field({ type: [FormQuestionRef], resolve: (f) => f.questions }),
  }),
});
