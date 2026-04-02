import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/auth-schema.ts', './src/business-schema.ts'],
  out: './drizzle',
  dialect: 'sqlite',
});
