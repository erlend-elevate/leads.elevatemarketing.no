import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // Kreves kun for `drizzle-kit migrate` — `generate` fungerer uten DB
    url: process.env.DATABASE_URL ?? '',
  },
});
