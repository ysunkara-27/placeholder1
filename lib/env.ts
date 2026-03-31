import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  APPLY_ENGINE_BASE_URL: z.string().url().optional(),
  APPLY_ENGINE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  APPLY_QUEUE_WORKER_SECRET: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SMS_PROVIDER: z.enum(["plivo", "twilio"]).default("plivo"),
  PLIVO_AUTH_ID: z.string().min(1).optional(),
  PLIVO_AUTH_TOKEN: z.string().min(1).optional(),
  PLIVO_PHONE_NUMBER: z.string().min(1).optional(),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_PHONE_NUMBER: z.string().min(1).optional(),
});

function parsePublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

function parseServerEnv() {
  return serverEnvSchema.parse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    APPLY_ENGINE_BASE_URL: process.env.APPLY_ENGINE_BASE_URL,
    APPLY_ENGINE_TIMEOUT_MS: process.env.APPLY_ENGINE_TIMEOUT_MS,
    APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS: process.env.APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS,
    APPLY_QUEUE_WORKER_SECRET: process.env.APPLY_QUEUE_WORKER_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SMS_PROVIDER: process.env.SMS_PROVIDER,
    PLIVO_AUTH_ID: process.env.PLIVO_AUTH_ID,
    PLIVO_AUTH_TOKEN: process.env.PLIVO_AUTH_TOKEN,
    PLIVO_PHONE_NUMBER: process.env.PLIVO_PHONE_NUMBER,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  });
}

export type SmsProvider = "plivo" | "twilio";

export function getPublicEnv() {
  return parsePublicEnv();
}

export function getServerEnv() {
  return parseServerEnv();
}

export function getSupabaseEnv() {
  const env = parseServerEnv();

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function getApplyEngineEnv() {
  const env = parseServerEnv();

  return {
    baseUrl: env.APPLY_ENGINE_BASE_URL,
    timeoutMs: env.APPLY_ENGINE_TIMEOUT_MS ?? 240_000,
    greenhouseTimeoutMs: env.APPLY_ENGINE_GREENHOUSE_TIMEOUT_MS ?? 420_000,
  };
}

export function getApplyQueueEnv() {
  const env = parseServerEnv();

  return {
    workerSecret: env.APPLY_QUEUE_WORKER_SECRET,
  };
}

export function getSmsProviderEnv() {
  const env = parseServerEnv();

  return {
    provider: env.SMS_PROVIDER,
    plivo: {
      authId: env.PLIVO_AUTH_ID,
      authToken: env.PLIVO_AUTH_TOKEN,
      phoneNumber: env.PLIVO_PHONE_NUMBER,
    },
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      phoneNumber: env.TWILIO_PHONE_NUMBER,
    },
  };
}
