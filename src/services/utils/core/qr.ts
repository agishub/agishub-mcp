/**
 * QR generation via qrcode-generator (pure JS, no deps, Workers-safe). We build
 * the SVG ourselves from the module matrix (getModuleCount + isDark) so we don't
 * depend on the library's SVG helper — keeps output fully under our control.
 */
import qrcode from "qrcode-generator";

export type EcLevel = "L" | "M" | "Q" | "H";

export function makeQr(text: string, size = 6, margin = 4, ec: EcLevel = "M") {
  const qr = qrcode(0, ec); // typeNumber 0 = auto-fit
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const dim = (count + margin * 2) * size;
  let rects = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        rects += `<rect x="${(c + margin) * size}" y="${(r + margin) * size}" width="${size}" height="${size}"/>`;
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" ` +
    `viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects}</g></svg>`;
  return {
    text,
    modules: count,
    ec_level: ec,
    cell_size: size,
    margin,
    dimension_px: dim,
    svg,
    data_uri: `data:image/svg+xml;base64,${btoa(svg)}`,
  };
}
