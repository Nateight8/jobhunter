import { and, asc, eq } from "drizzle-orm";
import {
  documents,
  education,
  experiences,
  profiles,
  projects,
  skills,
  type NewProfile,
  type Profile,
} from "@workspace/db";
import type { Db } from "../../lib/db";
import { ValidationError } from "../../lib/errors";
import { email, int, list, month, phone, requiredStr, str, url } from "../../lib/validate";

type Maybe<T> = T | null | undefined;

export type ProfileInput = {
  fullName?: Maybe<string>;
  email?: Maybe<string>;
  phone?: Maybe<string>;
  headline?: Maybe<string>;
  summary?: Maybe<string>;
  city?: Maybe<string>;
  country?: Maybe<string>;
  timezone?: Maybe<string>;
  linkedinUrl?: Maybe<string>;
  githubUrl?: Maybe<string>;
  portfolioUrl?: Maybe<string>;
  links?: Maybe<{ label: string; url: string }[]>;
  yearsExperience?: Maybe<number>;
  authorizedRegions?: Maybe<string[]>;
};

export type ExperienceInput = {
  company: string;
  title: string;
  location?: Maybe<string>;
  startDate?: Maybe<string>;
  endDate?: Maybe<string>;
  isCurrent?: Maybe<boolean>;
  bullets?: Maybe<string[]>;
  technologies?: Maybe<string[]>;
};

export type EducationInput = {
  school: string;
  degree?: Maybe<string>;
  field?: Maybe<string>;
  startDate?: Maybe<string>;
  endDate?: Maybe<string>;
};

export type ProjectInput = {
  name: string;
  url?: Maybe<string>;
  description?: Maybe<string>;
  bullets?: Maybe<string[]>;
  technologies?: Maybe<string[]>;
};

export type SkillInput = { name: string; category?: Maybe<string> };

const MAX_ENTRIES = 50;

// Single user for now: the first profile row is the profile.
export async function getOrCreateProfile(db: Db): Promise<Profile> {
  const [existing] = await db.select().from(profiles).orderBy(asc(profiles.createdAt)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(profiles).values({}).returning();
  return created!;
}

export async function saveProfile(db: Db, input: ProfileInput): Promise<Profile> {
  const profile = await getOrCreateProfile(db);

  const patch: Partial<NewProfile> = {
    fullName: str("fullName", input.fullName, 200),
    email: email("email", input.email),
    phone: phone("phone", input.phone),
    headline: str("headline", input.headline, 200),
    summary: str("summary", input.summary, 3000),
    city: str("city", input.city, 120),
    country: str("country", input.country, 120),
    timezone: str("timezone", input.timezone, 64),
    linkedinUrl: url("linkedinUrl", input.linkedinUrl),
    githubUrl: url("githubUrl", input.githubUrl),
    portfolioUrl: url("portfolioUrl", input.portfolioUrl),
    yearsExperience: int("yearsExperience", input.yearsExperience, 0, 60),
  };
  if (input.links !== undefined) {
    const links = (input.links ?? []).map((l) => ({
      label: requiredStr("link label", l.label, 60),
      url: url("link url", l.url)!,
    }));
    if (links.length > 10) throw new ValidationError("links: too many (max 10)");
    patch.links = links;
  }
  if (input.authorizedRegions !== undefined) {
    patch.authorizedRegions = [...new Set(list("authorizedRegions", input.authorizedRegions, 30, 60))];
  }

  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<NewProfile>;
  if (Object.keys(defined).length === 0) return profile;

  const [updated] = await db
    .update(profiles)
    .set(defined)
    .where(eq(profiles.id, profile.id))
    .returning();
  return updated!;
}

function checkCount(name: string, n: number) {
  if (n > MAX_ENTRIES) throw new ValidationError(`${name}: too many entries (max ${MAX_ENTRIES})`);
}

function checkRange(name: string, start: string | null | undefined, end: string | null | undefined) {
  if (start && end && start > end) throw new ValidationError(`${name}: start date is after end date`);
}

// Section edits replace the whole list in one transaction; position = array index.

export async function replaceExperiences(db: Db, items: ExperienceInput[]): Promise<Profile> {
  checkCount("experiences", items.length);
  const rows = items.map((e, position) => {
    const isCurrent = e.isCurrent ?? false;
    const startDate = month("startDate", e.startDate) ?? null;
    const endDate = isCurrent ? null : (month("endDate", e.endDate) ?? null);
    checkRange("experience", startDate, endDate);
    return {
      position,
      company: requiredStr("company", e.company, 200),
      title: requiredStr("title", e.title, 200),
      location: str("location", e.location, 200) ?? null,
      startDate,
      endDate,
      isCurrent,
      bullets: list("bullets", e.bullets, 30, 600),
      technologies: list("technologies", e.technologies, 40, 60),
    };
  });
  const profile = await getOrCreateProfile(db);
  await db.transaction(async (tx) => {
    await tx.delete(experiences).where(eq(experiences.profileId, profile.id));
    if (rows.length) {
      await tx.insert(experiences).values(rows.map((r) => ({ ...r, profileId: profile.id })));
    }
  });
  return profile;
}

export async function replaceEducation(db: Db, items: EducationInput[]): Promise<Profile> {
  checkCount("education", items.length);
  const rows = items.map((e, position) => {
    const startDate = month("startDate", e.startDate) ?? null;
    const endDate = month("endDate", e.endDate) ?? null;
    checkRange("education", startDate, endDate);
    return {
      position,
      school: requiredStr("school", e.school, 200),
      degree: str("degree", e.degree, 200) ?? null,
      field: str("field", e.field, 200) ?? null,
      startDate,
      endDate,
    };
  });
  const profile = await getOrCreateProfile(db);
  await db.transaction(async (tx) => {
    await tx.delete(education).where(eq(education.profileId, profile.id));
    if (rows.length) {
      await tx.insert(education).values(rows.map((r) => ({ ...r, profileId: profile.id })));
    }
  });
  return profile;
}

export async function replaceProjects(db: Db, items: ProjectInput[]): Promise<Profile> {
  checkCount("projects", items.length);
  const rows = items.map((p, position) => ({
    position,
    name: requiredStr("name", p.name, 200),
    url: url("url", p.url) ?? null,
    description: str("description", p.description, 2000) ?? null,
    bullets: list("bullets", p.bullets, 30, 600),
    technologies: list("technologies", p.technologies, 40, 60),
  }));
  const profile = await getOrCreateProfile(db);
  await db.transaction(async (tx) => {
    await tx.delete(projects).where(eq(projects.profileId, profile.id));
    if (rows.length) {
      await tx.insert(projects).values(rows.map((r) => ({ ...r, profileId: profile.id })));
    }
  });
  return profile;
}

export async function replaceSkills(db: Db, items: SkillInput[]): Promise<Profile> {
  checkCount("skills", items.length * 0 + Math.min(items.length, MAX_ENTRIES * 4) / 4);
  if (items.length > 300) throw new ValidationError("skills: too many (max 300)");
  const seen = new Set<string>();
  const rows: { position: number; name: string; category: string | null }[] = [];
  for (const s of items) {
    const name = requiredStr("skill", s.name, 60);
    const key = name.toLowerCase();
    if (seen.has(key)) continue; // the table is unique per (profile, name)
    seen.add(key);
    rows.push({ position: rows.length, name, category: str("category", s.category, 60) ?? null });
  }
  const profile = await getOrCreateProfile(db);
  await db.transaction(async (tx) => {
    await tx.delete(skills).where(eq(skills.profileId, profile.id));
    if (rows.length) {
      await tx.insert(skills).values(rows.map((r) => ({ ...r, profileId: profile.id })));
    }
  });
  return profile;
}

export const listExperiences = (db: Db, profileId: string) =>
  db.select().from(experiences).where(eq(experiences.profileId, profileId)).orderBy(asc(experiences.position));

export const listEducation = (db: Db, profileId: string) =>
  db.select().from(education).where(eq(education.profileId, profileId)).orderBy(asc(education.position));

export const listProjects = (db: Db, profileId: string) =>
  db.select().from(projects).where(eq(projects.profileId, profileId)).orderBy(asc(projects.position));

export const listSkills = (db: Db, profileId: string) =>
  db.select().from(skills).where(eq(skills.profileId, profileId)).orderBy(asc(skills.position));

// What is still missing before the profile can drive an application.
export async function readiness(db: Db, p: Profile) {
  const [cv] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.profileId, p.id), eq(documents.kind, "cv"), eq(documents.isDefault, true)))
    .limit(1);

  const missing: string[] = [];
  if (!p.fullName) missing.push("fullName");
  if (!p.email) missing.push("email");
  if (!p.phone) missing.push("phone");
  if (!p.country) missing.push("country");
  if (p.authorizedRegions.length === 0) missing.push("authorizedRegions");
  if (!cv) missing.push("cv");
  return { ready: missing.length === 0, missing };
}
