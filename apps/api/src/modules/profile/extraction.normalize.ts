import type { ExtractedProfile } from "./extraction.schema";

const clean = (s: string | null | undefined): string | null => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t : null;
};

const cleanList = (items: string[], max: number): string[] =>
  items.map((i) => clean(i)).filter((i): i is string => !!i).slice(0, max);

// Output is always YYYY-MM or null. A bare year becomes January of that year.
function month(v: string | null): string | null {
  const s = v?.trim();
  if (!s) return null;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
  if (/^\d{4}$/.test(s)) return `${s}-01`;
  const m = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(s);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function normalizeExtraction(raw: ExtractedProfile): ExtractedProfile {
  const seen = new Set<string>();
  const skills: ExtractedProfile["skills"] = [];
  for (const s of raw.skills) {
    const name = clean(s.name);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    skills.push({ name, category: clean(s.category) });
    if (skills.length >= 300) break;
  }

  return {
    fullName: clean(raw.fullName),
    email: clean(raw.email)?.toLowerCase() ?? null,
    phone: clean(raw.phone),
    headline: clean(raw.headline),
    summary: clean(raw.summary),
    city: clean(raw.city),
    country: clean(raw.country),
    linkedinUrl: clean(raw.linkedinUrl),
    githubUrl: clean(raw.githubUrl),
    portfolioUrl: clean(raw.portfolioUrl),
    otherLinks: raw.otherLinks
      .map((l) => ({ label: clean(l.label) ?? "", url: clean(l.url) ?? "" }))
      .filter((l) => l.label && l.url)
      .slice(0, 10),
    experiences: raw.experiences.slice(0, 50).map((e) => ({
      company: clean(e.company) ?? "",
      title: clean(e.title) ?? "",
      location: clean(e.location),
      startDate: month(e.startDate),
      endDate: e.isCurrent ? null : month(e.endDate),
      isCurrent: e.isCurrent,
      bullets: cleanList(e.bullets, 30),
      technologies: cleanList(e.technologies, 40),
    })),
    education: raw.education.slice(0, 50).map((e) => ({
      school: clean(e.school) ?? "",
      degree: clean(e.degree),
      field: clean(e.field),
      startDate: month(e.startDate),
      endDate: month(e.endDate),
    })),
    projects: raw.projects.slice(0, 50).map((p) => ({
      name: clean(p.name) ?? "",
      url: clean(p.url),
      description: clean(p.description),
      bullets: cleanList(p.bullets, 30),
      technologies: cleanList(p.technologies, 40),
    })),
    skills,
  };
}
