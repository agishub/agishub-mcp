/**
 * Best-effort email alert to the AgisHub team when a request comes in. This is a
 * SAFETY NET on top of GitHub's own "watch" emails, because GitHub does not notify
 * you about discussions your own token created — so if the posting token belongs
 * to the team account, the watch email never arrives. This direct email does.
 *
 * Entirely optional: it only fires when RESEND_API_KEY and FEEDBACK_EMAIL_FROM are
 * set. It never throws — a failed alert must not fail the request submission.
 */

export async function notifyTeam(
  env: Env,
  args: { subject: string; text: string },
): Promise<void> {
  const key = env.RESEND_API_KEY;
  const from = env.FEEDBACK_EMAIL_FROM;
  const to = env.FEEDBACK_NOTIFY_EMAIL || "jmavid@gmail.com";
  if (!key || !from) return; // not configured — rely on GitHub watch emails
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject: args.subject, text: args.text }),
    });
  } catch {
    /* best-effort: never break the submission over a failed alert */
  }
}
