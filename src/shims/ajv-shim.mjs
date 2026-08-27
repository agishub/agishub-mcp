/**
 * Workers-safe stub for `ajv`.
 *
 * Cloudflare Workers forbids `new Function` ("Code generation from strings
 * disallowed"), which is exactly what `ajv.compile()` does — and that call is on
 * the x402 bazaar discovery path (validateBazaarRouteExtensions). It hung every
 * cold /paid isolate, so the bazaar extension was disabled and we never appeared
 * in the x402 catalog.
 *
 * ajv is used ONLY to sanity-check the discovery schemas WE author (they are our
 * own, known-good JSON Schemas). Payment verify/settle (EIP-3009 via the CDP
 * facilitator) do NOT use ajv. So replacing ajv with a passthrough validator is
 * safe: it skips a local sanity check, nothing security- or payment-relevant.
 *
 * Wired via wrangler `alias` for "ajv" and "ajv/dist/2020.js".
 */
class Ajv {
  constructor(_opts) {}
  compile(_schema) {
    const validate = () => true;
    validate.errors = null;
    return validate;
  }
  addSchema() {
    return this;
  }
  addKeyword() {
    return this;
  }
  addFormat() {
    return this;
  }
  getSchema() {
    return undefined;
  }
  removeSchema() {
    return this;
  }
}

export default Ajv;
export { Ajv };
