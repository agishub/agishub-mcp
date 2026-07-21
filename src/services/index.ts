/**
 * Service Registry. Loads every service and exposes operations by their canonical
 * id `<service>.<operation>`. Adding a service = import it and push it here; no
 * adapter, billing or catalog wiring needs to change.
 */

import type { Operation, ServiceDefinition } from "./types";
import { timezoneService } from "./timezone";
import { webService } from "./web";

export const services: ServiceDefinition[] = [timezoneService, webService];

const byId = new Map<string, Operation>();
for (const svc of services) {
  for (const [name, op] of Object.entries(svc.operations)) {
    byId.set(`${svc.name}.${name}`, op);
  }
}

export function resolveOperation(id: string): Operation | undefined {
  return byId.get(id);
}

export function allOperationIds(): string[] {
  return [...byId.keys()];
}
