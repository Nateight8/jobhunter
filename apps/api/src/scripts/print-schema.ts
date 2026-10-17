import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lexicographicSortSchema, printSchema } from "graphql";
import { schema } from "../schema";

const out = fileURLToPath(new URL("../../schema.graphql", import.meta.url));
writeFileSync(out, printSchema(lexicographicSortSchema(schema)) + "\n");
console.log(`wrote ${out}`);
