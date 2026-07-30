/**
 * Headless browser automation via Cloudflare Browser Rendering + puppeteer binding.
 * Opens a URL and runs an ordered list of steps (click, type, press, wait, extract
 * text, screenshot). One browser per call, always closed in `finally`.
 */
import puppeteer from "@cloudflare/puppeteer";

export interface Step {
  action: "click" | "type" | "press" | "wait" | "extract_text" | "screenshot";
  selector?: string;
  text?: string;
  ms?: number;
}

function toB64(buf: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(bin);
}

export async function automate(env: Env | undefined, url: string, steps: Step[] = [], screenshot = false) {
  if (!env?.BROWSER) throw new Error("Browser automation is not configured (missing BROWSER binding).");
  if (!/^https?:\/\//i.test(url)) throw new Error("Only http/https URLs are allowed.");

  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

    const results: unknown[] = [];
    for (const s of steps) {
      try {
        switch (s.action) {
          case "click":
            if (!s.selector) throw new Error("click needs a selector");
            await page.click(s.selector);
            results.push({ action: "click", selector: s.selector, ok: true });
            break;
          case "type":
            if (!s.selector) throw new Error("type needs a selector");
            await page.type(s.selector, s.text ?? "");
            results.push({ action: "type", selector: s.selector, ok: true });
            break;
          case "press":
            await page.keyboard.press((s.text as never) ?? ("Enter" as never));
            results.push({ action: "press", key: s.text ?? "Enter", ok: true });
            break;
          case "wait":
            if (s.selector) await page.waitForSelector(s.selector, { timeout: 15000 });
            else await new Promise((r) => setTimeout(r, Math.min(s.ms ?? 1000, 10000)));
            results.push({ action: "wait", ok: true });
            break;
          case "extract_text": {
            // Callbacks run in the browser context; use `any`/string form so the
            // Worker's (non-DOM) TS lib doesn't flag HTMLElement/document.
            const t: string = s.selector
              ? ((await page.$eval(s.selector, (el: any) => el.textContent)) as string)
              : ((await page.evaluate("document.body.innerText")) as string);
            results.push({ action: "extract_text", selector: s.selector, text: (t ?? "").slice(0, 5000) });
            break;
          }
          case "screenshot": {
            const shot = (await page.screenshot({ type: "png" })) as Uint8Array;
            results.push({ action: "screenshot", base64: toB64(shot) });
            break;
          }
        }
      } catch (e) {
        results.push({ action: s.action, selector: s.selector, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const final_url = page.url();
    const out: Record<string, unknown> = { start_url: url, final_url, steps: results };
    if (screenshot) {
      const shot = (await page.screenshot({ type: "png", fullPage: true })) as Uint8Array;
      out.screenshot_base64 = toB64(shot);
    }
    return out;
  } finally {
    await browser.close();
  }
}
