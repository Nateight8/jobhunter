import type { Education, Experience, Profile, Project, Skill } from "@workspace/db";
import { builder } from "../../builder";
import {
  listEducation,
  listExperiences,
  listProjects,
  listSkills,
  readiness,
} from "./profile.service";

const monthOf = (d: string | null) => (d ? d.slice(0, 7) : null); // YYYY-MM

export const LinkRef = builder.objectRef<{ label: string; url: string }>("ProfileLink");
LinkRef.implement({
  fields: (t) => ({
    label: t.exposeString("label"),
    url: t.exposeString("url"),
  }),
});

const ExperienceRef = builder.objectRef<Experience>("Experience");
ExperienceRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    company: t.exposeString("company"),
    title: t.exposeString("title"),
    location: t.exposeString("location", { nullable: true }),
    startDate: t.string({ nullable: true, resolve: (e) => monthOf(e.startDate) }),
    endDate: t.string({ nullable: true, resolve: (e) => monthOf(e.endDate) }),
    isCurrent: t.exposeBoolean("isCurrent"),
    bullets: t.exposeStringList("bullets"),
    technologies: t.exposeStringList("technologies"),
  }),
});

const EducationRef = builder.objectRef<Education>("Education");
EducationRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    school: t.exposeString("school"),
    degree: t.exposeString("degree", { nullable: true }),
    field: t.exposeString("field", { nullable: true }),
    startDate: t.string({ nullable: true, resolve: (e) => monthOf(e.startDate) }),
    endDate: t.string({ nullable: true, resolve: (e) => monthOf(e.endDate) }),
  }),
});

const ProjectRef = builder.objectRef<Project>("Project");
ProjectRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    url: t.exposeString("url", { nullable: true }),
    description: t.exposeString("description", { nullable: true }),
    bullets: t.exposeStringList("bullets"),
    technologies: t.exposeStringList("technologies"),
  }),
});

const SkillRef = builder.objectRef<Skill>("Skill");
SkillRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    category: t.exposeString("category", { nullable: true }),
  }),
});

const ReadinessRef = builder.objectRef<{ ready: boolean; missing: string[] }>("ProfileReadiness");
ReadinessRef.implement({
  description:
    "missing holds any of: fullName, email, phone, country, authorizedRegions, cv",
  fields: (t) => ({
    ready: t.exposeBoolean("ready"),
    missing: t.exposeStringList("missing"),
  }),
});

export const ProfileRef = builder.objectRef<Profile>("Profile");
ProfileRef.implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    fullName: t.exposeString("fullName", { nullable: true }),
    email: t.exposeString("email", { nullable: true }),
    phone: t.exposeString("phone", { nullable: true }),
    headline: t.exposeString("headline", { nullable: true }),
    summary: t.exposeString("summary", { nullable: true }),
    city: t.exposeString("city", { nullable: true }),
    country: t.exposeString("country", { nullable: true }),
    timezone: t.exposeString("timezone", { nullable: true }),
    linkedinUrl: t.exposeString("linkedinUrl", { nullable: true }),
    githubUrl: t.exposeString("githubUrl", { nullable: true }),
    portfolioUrl: t.exposeString("portfolioUrl", { nullable: true }),
    links: t.field({ type: [LinkRef], resolve: (p) => p.links }),
    yearsExperience: t.exposeInt("yearsExperience", { nullable: true }),
    authorizedRegions: t.exposeStringList("authorizedRegions"),
    confirmedAt: t.string({ nullable: true, resolve: (p) => p.confirmedAt?.toISOString() ?? null }),
    experiences: t.field({ type: [ExperienceRef], resolve: (p, _a, ctx) => listExperiences(ctx.db, p.id) }),
    education: t.field({ type: [EducationRef], resolve: (p, _a, ctx) => listEducation(ctx.db, p.id) }),
    projects: t.field({ type: [ProjectRef], resolve: (p, _a, ctx) => listProjects(ctx.db, p.id) }),
    skills: t.field({ type: [SkillRef], resolve: (p, _a, ctx) => listSkills(ctx.db, p.id) }),
    readiness: t.field({ type: ReadinessRef, resolve: (p, _a, ctx) => readiness(ctx.db, p) }),
  }),
});

// Inputs. Omitted field = leave unchanged, null = clear.

export const ProfileLinkInput = builder.inputType("ProfileLinkInput", {
  fields: (t) => ({
    label: t.string({ required: true }),
    url: t.string({ required: true }),
  }),
});

export const ProfileInput = builder.inputType("ProfileInput", {
  fields: (t) => ({
    fullName: t.string(),
    email: t.string(),
    phone: t.string(),
    headline: t.string(),
    summary: t.string(),
    city: t.string(),
    country: t.string(),
    timezone: t.string(),
    linkedinUrl: t.string(),
    githubUrl: t.string(),
    portfolioUrl: t.string(),
    links: t.field({ type: [ProfileLinkInput] }),
    yearsExperience: t.int(),
    authorizedRegions: t.stringList(),
  }),
});

export const ExperienceInput = builder.inputType("ExperienceInput", {
  description: "Dates look like 2024-05. Ignored endDate when isCurrent is true.",
  fields: (t) => ({
    company: t.string({ required: true }),
    title: t.string({ required: true }),
    location: t.string(),
    startDate: t.string(),
    endDate: t.string(),
    isCurrent: t.boolean(),
    bullets: t.stringList(),
    technologies: t.stringList(),
  }),
});

export const EducationInput = builder.inputType("EducationInput", {
  fields: (t) => ({
    school: t.string({ required: true }),
    degree: t.string(),
    field: t.string(),
    startDate: t.string(),
    endDate: t.string(),
  }),
});

export const ProjectInput = builder.inputType("ProjectInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    url: t.string(),
    description: t.string(),
    bullets: t.stringList(),
    technologies: t.stringList(),
  }),
});

export const SkillInput = builder.inputType("SkillInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    category: t.string(),
  }),
});

export const ConfirmProfileInput = builder.inputType("ConfirmProfileInput", {
  description: "The full reviewed profile. Every list replaces what is stored.",
  fields: (t) => ({
    profile: t.field({ type: ProfileInput, required: true }),
    experiences: t.field({ type: [ExperienceInput], required: true }),
    education: t.field({ type: [EducationInput], required: true }),
    projects: t.field({ type: [ProjectInput], required: true }),
    skills: t.field({ type: [SkillInput], required: true }),
  }),
});
