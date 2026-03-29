import { getSmsProviderEnv } from "@/lib/env";

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function sendPlivo(
  authId: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<SmsSendResult> {
  const url = `https://api.plivo.com/v1/Account/${authId}/Message/`;
  const credentials = Buffer.from(`${authId}:${authToken}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ src: from, dst: to, text: body }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return { success: false, error: `Plivo ${res.status}: ${text}` };
  }

  const json = (await res.json()) as { message_uuid?: string[] };
  return {
    success: true,
    messageId: json.message_uuid?.[0],
  };
}

async function sendTwilio(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<SmsSendResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const params = new URLSearchParams({ From: from, To: to, Body: body });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return { success: false, error: `Twilio ${res.status}: ${text}` };
  }

  const json = (await res.json()) as { sid?: string };
  return {
    success: true,
    messageId: json.sid,
  };
}

export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  const env = getSmsProviderEnv();

  if (env.provider === "plivo") {
    const { authId, authToken, phoneNumber } = env.plivo;

    if (!authId || !authToken || !phoneNumber) {
      return { success: false, error: "Plivo credentials not configured" };
    }

    return sendPlivo(authId, authToken, phoneNumber, to, body);
  }

  const { accountSid, authToken, phoneNumber } = env.twilio;

  if (!accountSid || !authToken || !phoneNumber) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  return sendTwilio(accountSid, authToken, phoneNumber, to, body);
}
