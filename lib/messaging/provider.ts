import { getSmsProviderEnv, type SmsProvider } from "@/lib/env";

export interface SmsProviderSelection {
  provider: SmsProvider;
  configured: boolean;
  fromPhoneNumber: string | null;
}

export function getSmsProviderSelection(): SmsProviderSelection {
  const env = getSmsProviderEnv();

  if (env.provider === "plivo") {
    return {
      provider: "plivo",
      configured: Boolean(
        env.plivo.authId &&
          env.plivo.authToken &&
          env.plivo.phoneNumber
      ),
      fromPhoneNumber: env.plivo.phoneNumber ?? null,
    };
  }

  return {
    provider: "twilio",
    configured: Boolean(
      env.twilio.accountSid &&
        env.twilio.authToken &&
        env.twilio.phoneNumber
    ),
    fromPhoneNumber: env.twilio.phoneNumber ?? null,
  };
}
