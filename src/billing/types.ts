/**
 * Billing contracts. A BillingStrategy inspects the RequestContext (headers /
 * credentials), NOT the channel, to decide whether it applies and who the caller
 * is. authorize() returns a Principal — the common identity every adapter and
 * handler speaks, regardless of whether it came from x402, an API key, OAuth or
 * an enterprise plan.
 */

import type { RequestContext } from "../context";

export type PrincipalType = "x402" | "apiKey" | "oauth" | "enterprise" | "anonymous";

export interface Principal {
  type: PrincipalType;
  wallet?: string;
  plan?: string;
  permissions: string[];
  entitlements: string[];
}

export interface BillingStrategy {
  name: string;
  /** True if this strategy recognizes the credentials in the context. */
  matches(ctx: RequestContext): boolean;
  authorize(ctx: RequestContext): Promise<Principal>;
}
