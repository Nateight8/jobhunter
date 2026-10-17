import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createDb } from "@workspace/db";

config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (check the root .env)");

export const db = createDb(url);
export type Db = typeof db;
