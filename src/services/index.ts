/**
 * Service Registry. Loads every service and exposes operations by their canonical
 * id `<service>.<operation>`. Adding a service = import it and push it here; no
 * adapter, billing or catalog wiring needs to change.
 * Phase 3: Reorganized by market category (7 categories), consolidated namespaces.
 */

import type { Operation, ServiceDefinition } from "./types";
import { aiService } from "./ai";
import { webService } from "./web";
import { timeService } from "./time";
import { dataService } from "./data";
import { marketService } from "./market";
import { imageService } from "./image";
import { audioService } from "./audio";
import { documentService } from "./document";
import { urlService } from "./url";
import { qrService } from "./qr";
import { webhookService } from "./webhook";
import { memoryService } from "./memory";
import { feedbackService } from "./feedback";

export const services: ServiceDefinition[] = [
  // AI & Inference
  aiService,
  // Search & Web
  webService,
  // Data & Analytics
  timeService,
  dataService,
  // Market Data
  marketService,
  // Media & Generation
  imageService,
  audioService,
  documentService,
  // Developer Tools
  urlService,
  qrService,
  webhookService,
  feedbackService,
  // Knowledge & Memory
  memoryService,
];

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
