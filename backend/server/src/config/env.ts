import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';

// Load the monorepo root .env regardless of the working directory the server is started from.
// Server secrets live in the repo-root .env; fall back to a .env where the server is started.
dotenv.config({ path: path.join(REPO_ROOT, '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });

const envSchema = z.object({
  PORT: z.string().default('4000').transform(val => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  PROVIDER_TIMEOUT_MS: z.string().default('8000').transform(val => parseInt(val, 10)),
  ADZUNA_APP_ID: z.string().default(''),
  ADZUNA_APP_KEY: z.string().default(''),
  ADZUNA_DEFAULT_COUNTRY: z.string().default('in'),
  EVIDENCE_CACHE_TTL_JOBS_SEC: z.string().default('3600').transform(val => parseInt(val, 10)),
  EVIDENCE_CACHE_TTL_MARKET_SEC: z.string().default('86400').transform(val => parseInt(val, 10)),
  EVIDENCE_CACHE_TTL_STRUCTURAL_SEC: z.string().default('604800').transform(val => parseInt(val, 10)),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  REQUIRE_EMAIL_VERIFICATION: z.string().default('false').transform(v => v === 'true'),
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.8-flash,gemini-flash-latest'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  EVIDENCE_CACHE_FILE: z.string().default(path.join(REPO_ROOT, '.cache', 'evidence-cache.json')),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('CRITICAL: Environment configuration error:');
    for (const issue of error.issues) {
      console.error(` - ${issue.path.join('.')}: ${issue.message}`);
    }
  }
  parsedEnv = envSchema.parse({});
}

export const env = parsedEnv;
