import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext } from "playwright";

let context: BrowserContext | null = null;

/** One visible browser with its own persistent profile, so a login or CAPTCHA solved by hand sticks. */
export async function getContext(): Promise<BrowserContext> {
  if (context) return context;

  const dir =
    process.env.RUNNER_PROFILE_DIR ??
    fileURLToPath(new URL("../../../../data/browser-profile", import.meta.url));
  // Default: your installed Google Chrome. RUNNER_BROWSER=chromium uses Playwright's own build.
  const useChromium = (process.env.RUNNER_BROWSER ?? "chrome") === "chromium";

  try {
    context = await chromium.launchPersistentContext(dir, {
      headless: false,
      channel: useChromium ? undefined : "chrome",
      viewport: null,
    });
  } catch (e) {
    console.error(e);
    throw new Error(
      "Couldn't open the browser. Install Google Chrome, or set RUNNER_BROWSER=chromium in .env and run: pnpm --filter @workspace/api exec playwright install chromium",
    );
  }
  context.on("close", () => {
    context = null;
  });
  return context;
}
