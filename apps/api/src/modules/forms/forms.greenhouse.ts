export type FormKind = "text" | "textarea" | "select" | "multiselect" | "unsupported";

export type FormQuestionData = {
  key: string; // the form field name, e.g. question_1234567
  label: string;
  required: boolean;
  description: string | null;
  kind: FormKind;
  options: string[];
};
export type FormFileData = { key: string; label: string; required: boolean };
export type ParsedForm = {
  questions: FormQuestionData[];
  files: FormFileData[];
  hasSurvey: boolean; // optional EEOC / demographic questions exist; they are never filled automatically
};

// Covered by the profile (name, email, phone) or alternatives to an uploaded file.
const SKIP = new Set([
  "first_name", "last_name", "preferred_name", "email", "phone",
  "resume_text", "cover_letter_text", "latitude", "longitude",
]);

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function plain(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const decoded = v.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);
  const text = decoded.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 500) : null;
}

type Loose = Record<string, any>;

export function parseGreenhouseForm(payload: Loose): ParsedForm {
  const questions: FormQuestionData[] = [];
  const files: FormFileData[] = [];
  const seen = new Set<string>();

  const add = (raw: Loose) => {
    const fields: Loose[] = Array.isArray(raw.fields) ? raw.fields : [];
    const f = fields[0];
    const key = typeof f?.name === "string" ? f.name : "";
    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    if (!f || !key || !label || seen.has(key) || SKIP.has(key)) return;

    const type = String(f.type);
    if (type === "input_hidden") return;
    seen.add(key);
    const required = raw.required === true;

    if (type === "input_file") {
      files.push({ key, label, required });
      return;
    }

    let kind: FormKind = "unsupported";
    let options: string[] = [];
    if (fields.length === 1) {
      if (type === "input_text") kind = "text";
      else if (type === "textarea") kind = "textarea";
      else if (type === "multi_value_single_select") kind = "select";
      else if (type === "multi_value_multi_select") kind = "multiselect";
      if (kind === "select" || kind === "multiselect") {
        options = (Array.isArray(f.values) ? f.values : [])
          .map((v: Loose) => (typeof v?.label === "string" ? v.label.trim() : ""))
          .filter(Boolean);
      }
    }
    questions.push({ key, label, required, description: plain(raw.description), kind, options });
  };

  for (const q of Array.isArray(payload.questions) ? payload.questions : []) add(q);
  for (const q of Array.isArray(payload.location_questions) ? payload.location_questions : []) add(q);

  const eeoc =
    Array.isArray(payload.compliance) &&
    payload.compliance.some((c: Loose) => Array.isArray(c?.questions) && c.questions.length > 0);
  const demographic =
    Array.isArray(payload.demographic_questions?.questions) && payload.demographic_questions.questions.length > 0;

  return { questions, files, hasSurvey: eeoc || demographic };
}

export type FetchResult = { status: "ok"; form: ParsedForm } | { status: "gone" };

/** sourceId looks like "stripe:1234567". Public, read-only, no login. */
export async function fetchGreenhouseForm(sourceId: string): Promise<FetchResult> {
  const i = sourceId.indexOf(":");
  const slug = sourceId.slice(0, i);
  const id = sourceId.slice(i + 1);
  if (i < 1 || !/^[\w.-]+$/.test(slug) || !/^\d+$/.test(id)) throw new Error("Unexpected job id");

  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${id}?questions=true`,
    {
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "jobhunter/0.1 (open-source job aggregator)" },
    },
  );
  if (res.status === 404) return { status: "gone" };
  if (!res.ok) throw new Error(`Greenhouse returned ${res.status}`);
  return { status: "ok", form: parseGreenhouseForm((await res.json()) as Loose) };
}
