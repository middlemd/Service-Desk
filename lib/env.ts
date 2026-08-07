import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  AUTH0_DOMAIN: z.string().regex(/^[a-z0-9.-]+$/i, "AUTH0_DOMAIN must be a hostname"),
  AUTH0_CLIENT_ID: z.string().min(1),
  AUTH0_CLIENT_SECRET: z.string().min(1),
  AUTH0_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().url(),
  AUTH0_MGMT_CLIENT_ID: z.string().min(1),
  AUTH0_MGMT_CLIENT_SECRET: z.string().min(1),
  AUTH0_CONNECTION: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CSRF_SECRET: z.string().min(32),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv() {
  if (cachedEnv) return cachedEnv;
  cachedEnv = serverEnvSchema.parse(process.env);
  return cachedEnv;
}

export function isAppConfigured() {
  return Object.keys(serverEnvSchema.shape).every((key) => Boolean(process.env[key]));
}
