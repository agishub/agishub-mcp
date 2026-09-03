/**
 * Freemium gating for MCP (free) vs HTTP/x402 (paid) channels.
 * Standardizes the pattern: cap output on free tier, add upsell note, keep intact on paid.
 */

import type { OperationContext } from "../types";

export interface FreemiumGateOptions {
  /** Field name in result to cap (e.g., "markdown", "text", "summary") */
  capField: string;
  /** Max characters for free tier */
  freeCap: number;
  /** Upsell message to show on free tier when capped */
  upsell: string;
}

/**
 * Applies freemium gating to a result:
 * - MCP (free): caps the specified field, adds tier + note if capped
 * - HTTP/x402 (paid): returns result unchanged
 */
export function freemiumGate<T extends Record<string, any>>(
  ctx: OperationContext<any>,
  result: T,
  options: FreemiumGateOptions,
): T {
  const { capField, freeCap, upsell } = options;
  const isMcp = ctx.transport === "mcp";

  if (!isMcp) {
    // Paid tier: return as-is
    return result;
  }

  // Free tier: cap the field if needed
  const fieldValue = result[capField];
  if (typeof fieldValue !== "string") {
    // Field is not a string (or doesn't exist), return as-is
    return result;
  }

  if (fieldValue.length <= freeCap) {
    // Under cap, no truncation needed
    return result;
  }

  // Over cap: truncate and add upsell note
  const truncated = fieldValue.slice(0, freeCap).trimEnd();
  return {
    ...result,
    [capField]: truncated,
    truncated: true,
    tier: "free",
    note: upsell,
  } as T;
}

/**
 * Variant: for results that already track truncation (e.g., extract).
 * Adds tier + conditional upsell if truncation occurred.
 */
export function freemiumNote<T extends Record<string, any>>(
  ctx: OperationContext<any>,
  result: T,
  options: { truncated: boolean; upsell: string },
): T {
  const isMcp = ctx.transport === "mcp";

  if (!isMcp) {
    // Paid tier: return as-is (no tier/note fields)
    return result;
  }

  if (!options.truncated) {
    // Free tier but not truncated, no note needed
    return result;
  }

  // Free tier + truncated: add tier + upsell
  return {
    ...result,
    tier: "free",
    note: options.upsell,
  } as T;
}
