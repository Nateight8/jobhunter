import SchemaBuilder from "@pothos/core";
import type { Db } from "./lib/db";

export const builder = new SchemaBuilder<{ Context: { db: Db } }>({});

// Declared once here. Each module adds its fields with builder.queryFields(...).
builder.queryType({});
