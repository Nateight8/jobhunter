import SchemaBuilder from "@pothos/core";
import type { Db } from "./lib/db";

// Fields are non-null unless a field says `nullable: true`.
export const builder = new SchemaBuilder<{
  Context: { db: Db };
  DefaultFieldNullability: false;
}>({
  defaultFieldNullability: false,
});

// Declared once here. Each module adds its fields with builder.queryFields(...).
builder.queryType({});
