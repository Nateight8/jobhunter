import { GoogleGenAI, type Part } from "@google/genai";
import { ValidationError } from "./errors";

export function geminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim();
  if (!apiKey || !model) {
    throw new ValidationError(
      "Gemini is not configured. Set GEMINI_API_KEY and GEMINI_MODEL in the root .env, then restart the API.",
    );
  }
  return { apiKey, model };
}

/** One structured-output call. Returns the raw JSON text; callers validate it. */
export async function generateJson(args: {
  system: string;
  parts: Part[];
  schema: Record<string, unknown>;
}): Promise<string> {
  const { apiKey, model } = geminiConfig();
  const ai = new GoogleGenAI({ apiKey });
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: args.parts }],
      config: {
        systemInstruction: args.system,
        responseMimeType: "application/json",
        responseJsonSchema: args.schema,
        temperature: 0,
        httpOptions: { timeout: 120_000 },
      },
    });
    const text = res.text;
    if (!text) throw new ValidationError("Gemini returned no content. Try again.");
    return text;
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    const status = (e as { status?: number }).status;
    console.error("gemini request failed:", status, (e as Error).message);
    if (status === 429) {
      throw new ValidationError("Gemini rate limit reached. Wait a minute and try again.");
    }
    if (status === 404) {
      throw new ValidationError("Gemini model not found. Check GEMINI_MODEL in .env.");
    }
    if (status === 400 || status === 401 || status === 403) {
      throw new ValidationError("Gemini rejected the request. Check GEMINI_API_KEY and GEMINI_MODEL in .env.");
    }
    throw new ValidationError("The Gemini request failed. Try again.");
  }
}
