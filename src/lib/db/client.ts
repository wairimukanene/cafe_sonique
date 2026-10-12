import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  soniqueSql?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.soniqueSql ??
  postgres(env.DATABASE_URL, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.soniqueSql = client;
}

export const sqlClient = client;
export const db = drizzle(client, { schema });
