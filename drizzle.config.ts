import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://sonique:sonique_dev@localhost:54329/cafe_sonique",
  },
  strict: true,
  verbose: true,
});
