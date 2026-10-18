import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeFilter, type BoardFilter } from "./boards.filter";

export type BoardPreset = { id: string; name: string; description: string; filter: BoardFilter };

const dir = fileURLToPath(new URL("./presets/", import.meta.url));

// Presets are JSON files in ./presets, loaded once at startup. Add one by pull request.
function loadPresets(): BoardPreset[] {
  const out: BoardPreset[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    try {
      const raw = JSON.parse(readFileSync(dir + file, "utf8"));
      out.push({
        id: file.replace(/\.json$/, ""),
        name: String(raw.name),
        description: String(raw.description ?? ""),
        filter: normalizeFilter(raw.filter),
      });
    } catch (e) {
      console.warn(`Skipping preset ${file}: ${(e as Error).message}`);
    }
  }
  return out;
}

export const presets = loadPresets();
