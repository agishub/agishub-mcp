/**
 * PDF y captura de pantalla para el servicio `document`.
 *
 * Era una copia byte a byte de `render/core/browser.ts`, así que cualquier
 * arreglo había que hacerlo dos veces — y de hecho ambos fallaban igual cuando
 * `CF_API_TOKEN` perdió el permiso de Browser Rendering. Ahora reexporta la
 * única implementación, ya migrada al binding `BROWSER`.
 */

export { pdf, screenshot, RenderError } from "../../render/core/browser";
export type { PdfOptions, ScreenshotOptions } from "../../render/core/browser";
