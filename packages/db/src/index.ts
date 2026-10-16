import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export * from "./schema";
export const createDb = (url: string) => drizzle(url, { schema });
