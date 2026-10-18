import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Same file the pipeline reads: shared/regions.json at the repo root.
const path = fileURLToPath(new URL("../../../../shared/regions.json", import.meta.url));
const data = JSON.parse(readFileSync(path, "utf8")) as { regions: Record<string, { name: string }> };

export const isRegionCode = (code: string) => Object.hasOwn(data.regions, code);
export const regionName = (code: string) => data.regions[code]?.name ?? code;
