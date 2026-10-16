import { timestamp } from "drizzle-orm/pg-core";

export const tz = (name: string) => timestamp(name, { withTimezone: true });
