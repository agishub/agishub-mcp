/**
 * Platform primitives shared by every service. An Operation is pure business
 * logic: a zod input schema + a handler that receives a RequestContext. It has
 * NO id (the Service Registry assigns `<service>.<operation>`), no price and no
 * transport — those live in the Catalog and Billing layers respectively.
 */

import type { z } from "zod";
import type { RequestContext } from "../context";

/** A RequestContext whose `input` has been validated to the operation's type. */
export interface OperationContext<I = unknown> extends RequestContext {
  input: I;
}

export interface Operation<I = any, O = any> {
  schema: z.ZodObject<any>;
  handler: (ctx: OperationContext<I>) => O | Promise<O>;
}

/** Helper that infers the handler's input type from the zod schema. */
export function defineOperation<S extends z.ZodObject<any>, O>(
  schema: S,
  handler: (ctx: OperationContext<z.infer<S>>) => O | Promise<O>,
): Operation<z.infer<S>, O> {
  return { schema, handler: handler as Operation["handler"] };
}

export interface ServiceDefinition {
  name: string;
  operations: Record<string, Operation>;
}
