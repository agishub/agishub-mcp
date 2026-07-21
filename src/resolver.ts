/**
 * Resolver — maps a transport-specific identifier (an MCP tool name, or an HTTP
 * path segment from /v1/<seg> or /paid/<seg>) to a canonical operation id, its
 * Operation (from the Registry) and its Catalog entry. This is the single place
 * to add aliases, versioning or deprecations later; the adapters stay trivial.
 */

import type { Operation } from "./services/types";
import { resolveOperation } from "./services";
import { catalog, catalogEntry, type CatalogEntry } from "./catalog";
import type { Transport } from "./context";

export interface Resolution {
  operationId: string;
  operation: Operation;
  catalog: CatalogEntry;
}

const mcpByName = new Map<string, string>(); // tool name -> operation id
const httpBySeg = new Map<string, string>(); // path segment -> operation id

for (const [svc, ops] of Object.entries(catalog)) {
  for (const [name, entry] of Object.entries(ops)) {
    const id = `${svc}.${name}`;
    if (entry.channels.includes("mcp")) mcpByName.set(name, id);
    if (entry.channels.includes("http")) httpBySeg.set(entry.httpPath ?? name.replace(/_/g, "-"), id);
  }
}

function make(id: string | undefined): Resolution | undefined {
  if (!id) return undefined;
  const operation = resolveOperation(id);
  const entry = catalogEntry(id);
  if (!operation || !entry) return undefined;
  return { operationId: id, operation, catalog: entry };
}

export function resolve(transport: Transport, identifier: string): Resolution | undefined {
  const id = transport === "http" ? httpBySeg.get(identifier) : mcpByName.get(identifier);
  return make(id);
}

export interface McpOp extends Resolution {
  name: string;
}
export function mcpOperations(): McpOp[] {
  return [...mcpByName.entries()].map(([name, id]) => ({ name, ...make(id)! }));
}

export interface HttpOp extends Resolution {
  seg: string;
}
export function httpOperations(): HttpOp[] {
  return [...httpBySeg.entries()].map(([seg, id]) => ({ seg, ...make(id)! }));
}
