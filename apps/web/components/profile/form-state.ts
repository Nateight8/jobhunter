import type { ConfirmProfileInput, ProfileFieldsFragment } from "../../lib/gql/graphql";

type Draft = NonNullable<ProfileFieldsFragment["draft"]>;
export type DraftData = NonNullable<Draft["data"]>;

export type ExperienceForm = {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  bullets: string; // one per line
  technologies: string; // comma separated
};
export type EducationForm = {
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
};
export type ProjectForm = {
  name: string;
  url: string;
  description: string;
  bullets: string;
  technologies: string;
};

export type FormState = {
  fullName: string;
  email: string;
  phone: string;
  headline: string;
  summary: string;
  city: string;
  country: string;
  authorizedRegions: string; // comma separated
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  links: { label: string; url: string }[];
  experiences: ExperienceForm[];
  education: EducationForm[];
  projects: ProjectForm[];
  skills: string; // comma or line separated
  skillCategories: Record<string, string>; // lowercase name -> category, kept from the source
};

export const emptyExperience = (): ExperienceForm => ({
  company: "", title: "", location: "", startDate: "", endDate: "", isCurrent: false, bullets: "", technologies: "",
});
export const emptyEducation = (): EducationForm => ({
  school: "", degree: "", field: "", startDate: "", endDate: "",
});
export const emptyProject = (): ProjectForm => ({
  name: "", url: "", description: "", bullets: "", technologies: "",
});

type Src = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  headline?: string | null;
  summary?: string | null;
  city?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  links: { label: string; url: string }[];
  authorizedRegions: string[];
  experiences: {
    company: string;
    title: string;
    location?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isCurrent: boolean;
    bullets: string[];
    technologies: string[];
  }[];
  education: {
    school: string;
    degree?: string | null;
    field?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }[];
  projects: {
    name: string;
    url?: string | null;
    description?: string | null;
    bullets: string[];
    technologies: string[];
  }[];
  skills: { name: string; category?: string | null }[];
};

const s = (v: string | null | undefined) => v ?? "";

function fromSource(src: Src): FormState {
  const skillCategories: Record<string, string> = {};
  for (const k of src.skills) if (k.category) skillCategories[k.name.toLowerCase()] = k.category;
  return {
    fullName: s(src.fullName),
    email: s(src.email),
    phone: s(src.phone),
    headline: s(src.headline),
    summary: s(src.summary),
    city: s(src.city),
    country: s(src.country),
    authorizedRegions: src.authorizedRegions.join(", "),
    linkedinUrl: s(src.linkedinUrl),
    githubUrl: s(src.githubUrl),
    portfolioUrl: s(src.portfolioUrl),
    links: src.links.map((l) => ({ label: l.label, url: l.url })),
    experiences: src.experiences.map((e) => ({
      company: e.company,
      title: e.title,
      location: s(e.location),
      startDate: s(e.startDate),
      endDate: s(e.endDate),
      isCurrent: e.isCurrent,
      bullets: e.bullets.join("\n"),
      technologies: e.technologies.join(", "),
    })),
    education: src.education.map((e) => ({
      school: e.school,
      degree: s(e.degree),
      field: s(e.field),
      startDate: s(e.startDate),
      endDate: s(e.endDate),
    })),
    projects: src.projects.map((p) => ({
      name: p.name,
      url: s(p.url),
      description: s(p.description),
      bullets: p.bullets.join("\n"),
      technologies: p.technologies.join(", "),
    })),
    skills: src.skills.map((k) => k.name).join(", "),
    skillCategories,
  };
}

export const fromProfile = (p: ProfileFieldsFragment): FormState => fromSource(p);

// A draft has no regions or saved links, so those come from the current profile.
export function fromDraft(d: DraftData, p: ProfileFieldsFragment): FormState {
  return fromSource({
    ...d,
    country: d.country ?? p.country,
    links: d.otherLinks,
    authorizedRegions: p.authorizedRegions,
  });
}

const nul = (v: string) => v.trim() || null;
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
const csv = (v: string) => v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export const REQUIRED_LABELS: [keyof FormState, string][] = [
  ["fullName", "full name"],
  ["email", "email"],
  ["phone", "phone"],
  ["country", "country"],
  ["authorizedRegions", "regions you can work in"],
];

export function missingRequired(f: FormState): string[] {
  return REQUIRED_LABELS.filter(([key]) => !String(f[key]).trim()).map(([, label]) => label);
}

export function toInput(f: FormState): ConfirmProfileInput {
  return {
    profile: {
      fullName: nul(f.fullName),
      email: nul(f.email),
      phone: nul(f.phone),
      headline: nul(f.headline),
      summary: nul(f.summary),
      city: nul(f.city),
      country: nul(f.country),
      linkedinUrl: nul(f.linkedinUrl),
      githubUrl: nul(f.githubUrl),
      portfolioUrl: nul(f.portfolioUrl),
      links: f.links
        .filter((l) => l.label.trim() && l.url.trim())
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
      authorizedRegions: csv(f.authorizedRegions),
    },
    experiences: f.experiences
      .filter((e) => e.company.trim() || e.title.trim())
      .map((e) => ({
        company: e.company.trim(),
        title: e.title.trim(),
        location: nul(e.location),
        startDate: nul(e.startDate),
        endDate: e.isCurrent ? null : nul(e.endDate),
        isCurrent: e.isCurrent,
        bullets: lines(e.bullets),
        technologies: csv(e.technologies),
      })),
    education: f.education
      .filter((e) => e.school.trim())
      .map((e) => ({
        school: e.school.trim(),
        degree: nul(e.degree),
        field: nul(e.field),
        startDate: nul(e.startDate),
        endDate: nul(e.endDate),
      })),
    projects: f.projects
      .filter((p) => p.name.trim())
      .map((p) => ({
        name: p.name.trim(),
        url: nul(p.url),
        description: nul(p.description),
        bullets: lines(p.bullets),
        technologies: csv(p.technologies),
      })),
    skills: csv(f.skills).map((name) => ({
      name,
      category: f.skillCategories[name.toLowerCase()] ?? null,
    })),
  };
}
