/**
 * RequestContext — the single object that flows through the whole pipeline
 * (Adapter → Resolver → Billing → Handler). Every adapter builds one from its
 * transport-specific request; the Resolver fills operation/catalog, Billing
 * fills principal, and the Operation handler reads `input`.
 */

import type { Operation } from "./services/types";
import type { CatalogEntry } from "./catalog";
import type { Principal } from "./billing/types";

export type Transport = "mcp" | "http" | "stdio";

export interface RequestContext {
  transport: Transport;
  headers: Record<string, string>;
  /** Raw, unvalidated input as received from the transport. */
  rawInput: unknown;
  /** Worker bindings/secrets, for services that need them (KV, Browser, tokens). */
  env?: Env;
  /** Filled by the Resolver. */
  operationId?: string;
  operation?: Operation;
  catalog?: CatalogEntry;
  /** Validated input (Adapter parses rawInput with operation.schema). */
  input?: unknown;
  /** Filled by Billing.authorize(). */
  principal?: Principal;
}

export function buildContext(
  transport: Transport,
  headers: Record<string, string>,
  rawInput: unknown,
  env?: Env,
): RequestContext {
  return { transport, headers, rawInput, env };
}
