import type { ProfileDraft } from "@workspace/db";
import { builder } from "../../builder";
import type { ExtractedProfile } from "./extraction.schema";
import { getCurrentDraft } from "./extract.service";
import { LinkRef, ProfileRef } from "./profile.types";

type DraftExperience = ExtractedProfile["experiences"][number];
type DraftEducation = ExtractedProfile["education"][number];
type DraftProject = ExtractedProfile["projects"][number];
type DraftSkill = ExtractedProfile["skills"][number];

const DraftExperienceRef = builder.objectRef<DraftExperience>("DraftExperience");
DraftExperienceRef.implement({
  fields: (t) => ({
    company: t.exposeString("company"),
    title: t.exposeString("title"),
    location: t.exposeString("location", { nullable: true }),
    startDate: t.exposeString("startDate", { nullable: true }),
    endDate: t.exposeString("endDate", { nullable: true }),
    isCurrent: t.exposeBoolean("isCurrent"),
    bullets: t.exposeStringList("bullets"),
    technologies: t.exposeStringList("technologies"),
  }),
});

const DraftEducationRef = builder.objectRef<DraftEducation>("DraftEducation");
DraftEducationRef.implement({
  fields: (t) => ({
    school: t.exposeString("school"),
    degree: t.exposeString("degree", { nullable: true }),
    field: t.exposeString("field", { nullable: true }),
    startDate: t.exposeString("startDate", { nullable: true }),
    endDate: t.exposeString("endDate", { nullable: true }),
  }),
});

const DraftProjectRef = builder.objectRef<DraftProject>("DraftProject");
DraftProjectRef.implement({
  fields: (t) => ({
    name: t.exposeString("name"),
    url: t.exposeString("url", { nullable: true }),
    description: t.exposeString("description", { nullable: true }),
    bullets: t.exposeStringList("bullets"),
    technologies: t.exposeStringList("technologies"),
  }),
});

const DraftSkillRef = builder.objectRef<DraftSkill>("DraftSkill");
DraftSkillRef.implement({
  fields: (t) => ({
    name: t.exposeString("name"),
    category: t.exposeString("category", { nullable: true }),
  }),
});

const DraftProfileRef = builder.objectRef<ExtractedProfile>("DraftProfile");
DraftProfileRef.implement({
  description: "What the model read from the CV. Reviewed by the user before anything is saved.",
  fields: (t) => ({
    fullName: t.exposeString("fullName", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    headline: t.exposeString("headline", { nullable: true }),
    summary: t.exposeString("summary", { nullable: true }),
    city: t.exposeString("city", { nullable: true }),
    country: t.exposeString("country", { nullable: true }),
    linkedinUrl: t.exposeString("linkedinUrl", { nullable: true }),
    githubUrl: t.exposeString("githubUrl", { nullable: true }),
    portfolioUrl: t.exposeString("portfolioUrl", { nullable: true }),
    otherLinks: t.field({ type: [LinkRef], resolve: (d) => d.otherLinks }),
    experiences: t.field({ type: [DraftExperienceRef], resolve: (d) => d.experiences }),
    education: t.field({ type: [DraftEducationRef], resolve: (d) => d.education }),
    projects: t.field({ type: [DraftProjectRef], resolve: (d) => d.projects }),
    skills: t.field({ type: [DraftSkillRef], resolve: (d) => d.skills }),
  }),
});

export const ProfileDraftRef = builder.objectRef<ProfileDraft>("ProfileDraft");
ProfileDraftRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    status: t.exposeString("status", { description: "pending, ready or failed" }),
    model: t.exposeString("model", { nullable: true }),
    error: t.exposeString("error", { nullable: true }),
    documentId: t.exposeID("documentId", { nullable: true }),
    createdAt: t.string({ resolve: (d) => d.createdAt.toISOString() }),
    data: t.field({
      type: DraftProfileRef,
      nullable: true,
      resolve: (d) => (d.status === "ready" ? (d.data as ExtractedProfile) : null),
    }),
  }),
});

builder.objectField(ProfileRef, "draft", (t) =>
  t.field({
    type: ProfileDraftRef,
    nullable: true,
    description: "The live CV-extraction draft, if any.",
    resolve: (p, _args, ctx) => getCurrentDraft(ctx.db, p.id),
  }),
);
