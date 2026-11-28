import "server-only";

export type EmailMessage = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
};

export type EmailResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * Delivery is optional and never assumed. Without a provider the caller must
 * record the invitation as not sent and point the borrower at the share link —
 * the application must not claim an email was delivered when it was not.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return { ok: false, error: "Email delivery is not configured." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[email] provider rejected", response.status, detail.slice(0, 200));

      if (response.status === 403) {
        return {
          ok: false,
          error: "the provider only allows the account owner until a sending domain is verified",
        };
      }
      if (response.status === 429) {
        return { ok: false, error: "the provider is rate limiting requests" };
      }
      return { ok: false, error: `the provider returned ${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    console.error("[email] send failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "The email provider could not be reached." };
  }
}
