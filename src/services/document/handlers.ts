import type { z } from "zod";
import { avisoSiEsGratis } from "../_shared/solo-pago";
import type { OperationContext } from "../types";
import * as S from "./schemas";
import * as B from "./core/browser";

export async function pdf(
  ctx: OperationContext<z.infer<typeof S.pdf>>,
): Promise<Record<string, unknown>> {
  const aviso = avisoSiEsGratis(ctx, "pdf", "Renderiza la página en un navegador real para generar el PDF.");
  if (aviso) return aviso;
  return B.pdf(ctx.input, ctx.env);
}
