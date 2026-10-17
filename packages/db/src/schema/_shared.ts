import { customType, timestamp } from "drizzle-orm/pg-core";

export const tz = (name: string) => timestamp(name, { withTimezone: true });

// Drizzle has no bytea type; pg returns it as a Buffer.
export const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
