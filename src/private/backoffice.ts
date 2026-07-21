/**
 * timezone-toolkit — back-office mount point (public stub).
 *
 * The private back-office UI, health dashboards and agent test endpoints are
 * intentionally NOT part of this public repository. Upstream ships this no-op;
 * a private local copy provides the real routes at deploy time.
 */
import type { Hono } from "hono";

export function mountBackoffice(_app: Hono<{ Bindings: Env }>): void {
  // Not included in the public build.
}
