import type { z } from "zod";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import { createDiscussion } from "./core/github";
import { notifyTeam } from "./core/notify";

const IDEAS_BOARD = "https://github.com/agishub/agishub-mcp/discussions/categories/ideas";

const LABEL: Record<string, string> = {
  new_service: "New service",
  improvement: "Improvement",
  bug: "Bug report",
  other: "Feedback",
};

export async function feedback_request_feature(ctx: OperationContext<z.infer<typeof S.request_feature>>) {
  const { title, details, type, service, contact } = ctx.input;
  const label = LABEL[type] ?? "Feedback";
  const token = ctx.env?.GITHUB_TOKEN;

  // Not configured yet: don't drop the request — point the caller to the board.
  if (!token) {
    return {
      ok: false,
      message:
        "The request channel is not fully configured yet. Please post your request on the community board.",
      board: IDEAS_BOARD,
    };
  }

  const body = [
    details.trim(),
    "",
    "---",
    `**Type:** ${label}`,
    service ? `**Related service:** \`${service}\`` : "",
    contact ? `**Contact:** ${contact}` : "",
    "*Submitted by an agent via the AgisHub API (`feedback.request_feature`).*",
  ]
    .filter(Boolean)
    .join("\n");

  const discussion = await createDiscussion(token, { title: `[${label}] ${title}`, body });

  // Reliable email alert (independent of GitHub's own-action notification rules).
  await notifyTeam(ctx.env as Env, {
    subject: `New AgisHub request: [${label}] ${title}`,
    text: `${body}\n\nDiscussion: ${discussion.url}`,
  });

  return {
    ok: true,
    message: "Thanks — your request was posted to the AgisHub roadmap and the team was notified.",
    url: discussion.url,
    number: discussion.number,
  };
}
