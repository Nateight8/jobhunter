import { z } from "zod";

const date = (what: string) =>
  z.string().nullable().describe(`${what}: YYYY-MM, or just YYYY if only a year is written. Null if not written.`);

const experience = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  startDate: date("Start date"),
  endDate: date("End date (null if the role is ongoing)"),
  isCurrent: z.boolean().describe("True only if the CV says Present, Current or similar"),
  bullets: z.array(z.string()).describe("One item per achievement or responsibility, copied as written"),
  technologies: z.array(z.string()).describe("Only technologies named in this entry"),
});

const education = z.object({
  school: z.string(),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  startDate: date("Start date"),
  endDate: date("End date"),
});

const project = z.object({
  name: z.string(),
  url: z.string().nullable(),
  description: z.string().nullable(),
  bullets: z.array(z.string()),
  technologies: z.array(z.string()),
});

export const extractionSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  headline: z.string().nullable().describe("Professional title line near the name, if present"),
  summary: z.string().nullable().describe("The profile or summary paragraph, if present"),
  city: z.string().nullable(),
  country: z.string().nullable().describe("Country of the candidate's address, only if stated"),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  portfolioUrl: z.string().nullable(),
  otherLinks: z.array(z.object({ label: z.string(), url: z.string() })),
  experiences: z.array(experience),
  education: z.array(education),
  projects: z.array(project),
  skills: z.array(
    z.object({
      name: z.string().describe("One skill, tool or technology, not a sentence"),
      category: z.string().nullable().describe("Only if the CV groups skills under a heading"),
    }),
  ),
});

export type ExtractedProfile = z.infer<typeof extractionSchema>;

// Gemini wants plain JSON Schema without the $schema marker.
const schema = z.toJSONSchema(extractionSchema) as Record<string, unknown>;
delete schema.$schema;
export const extractionJsonSchema = schema;
