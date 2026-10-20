import type { Frame, Locator, Page } from "playwright";
import type { Outcome } from "../modules/apply/apply.service";
import type { JobFormView } from "../modules/forms/forms.service";
import { sleep } from "./db";

// This file fills a form. Nothing in it presses Submit, and nothing solves a CAPTCHA.

type Result = { state: Outcome["state"]; note?: string };

export type FillInput = {
  fullName: string;
  email: string;
  phone: string | null;
  cv: { name: string; mimeType: string; buffer: Buffer } | null;
  form: JobFormView;
};

const FIRST_NAME = 'input#first_name, input[name="first_name"]';
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cssId = (s: string) => s.replace(/[^\w-]/g, (c) => `\\${c}`);
const firstLine = (e: unknown) => String((e as Error)?.message ?? e).split("\n")[0]!.slice(0, 200);

async function appears(loc: Locator, ms: number): Promise<boolean> {
  try {
    await loc.first().waitFor({ state: "visible", timeout: ms });
    return true;
  } catch {
    return false;
  }
}

async function waitForForm(page: Page, ms: number): Promise<Frame | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    for (const f of page.frames()) {
      try {
        if ((await f.locator(FIRST_NAME).count()) > 0) return f;
      } catch {
        /* frame is navigating */
      }
    }
    await sleep(500);
  }
  return null;
}

/** Opens the hosted form first (a consistent page), then the posting's own URL (embedded forms live in an iframe). */
export async function openForm(page: Page, slug: string, id: string, jobUrl: string): Promise<Frame | null> {
  const canonical = `https://job-boards.greenhouse.io/${encodeURIComponent(slug)}/jobs/${id}`;
  for (const url of [canonical, jobUrl]) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch {
      continue;
    }
    const root = await waitForForm(page, 20_000);
    if (root) return root;
  }
  return null;
}

/** True once the application form is gone from every frame (it was submitted or the page moved on). */
export async function formGone(page: Page): Promise<boolean> {
  for (const f of page.frames()) {
    try {
      if ((await f.locator(FIRST_NAME).count()) > 0) return false;
    } catch {
      /* frame is navigating */
    }
  }
  return true;
}

const CONFIRMED =
  /thank(s| you) for applying|thank you for your application|application (has been )?(submitted|received)|received your application/i;

/** The form is gone AND the page looks like a confirmation. Both are required, to avoid false positives. */
export async function detectSubmission(page: Page): Promise<boolean> {
  if (!(await formGone(page))) return false;
  if (/[?&]application_id=|\/confirmation/i.test(page.url())) return true;
  for (const f of page.frames()) {
    try {
      const text = await f.locator("body").innerText({ timeout: 1500 });
      if (CONFIRMED.test(text)) return true;
    } catch {
      /* frame is gone or navigating */
    }
  }
  return false;
}

/** Debug aid (RUNNER_INSPECT=1): the form's controls, so selectors can be corrected from real pages. */
export async function inspectControls(root: Frame): Promise<string> {
  const items = await root.evaluate(() =>
    Array.from(document.querySelectorAll("input, textarea, select, [role=combobox], button"))
      .slice(0, 90)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        name: (el as HTMLInputElement).name || undefined,
        type: (el as HTMLInputElement).type || undefined,
        role: el.getAttribute("role") || undefined,
        aria: el.getAttribute("aria-label") || undefined,
        text: el.tagName === "BUTTON" ? (el.textContent ?? "").trim().slice(0, 40) : undefined,
      })),
  );
  return JSON.stringify(items);
}

async function findControl(root: Frame, key: string, label: string): Promise<Locator | null> {
  const base = key.replace(/\[\]$/, "");
  const candidates = [
    root.locator(`#${cssId(base)}`),
    root.locator(`[name="${base}"], [name="${base}[]"]`),
    root.getByLabel(label, { exact: true }),
    root.getByLabel(label),
  ];
  for (const c of candidates) {
    try {
      if ((await c.count()) > 0) return c.first();
    } catch {
      /* try the next way of finding it */
    }
  }
  return null;
}

async function mark(loc: Locator, color: string): Promise<void> {
  try {
    await loc.evaluate((el, c) => {
      const node = el as HTMLElement;
      node.style.outline = `2px solid ${c}`;
      node.style.outlineOffset = "2px";
    }, color);
  } catch {
    /* highlighting is a courtesy, never a failure */
  }
}

async function fillText(control: Locator, value: string): Promise<void> {
  await control.scrollIntoViewIfNeeded();
  await control.fill(value);
  if ((await control.inputValue()) !== value) throw new Error("the form changed the value");
}

// Greenhouse dropdowns are ARIA comboboxes: open the list, then click the option.
async function pickOption(root: Frame, control: Locator, option: string): Promise<void> {
  const tag = await control.evaluate((el) => el.tagName.toLowerCase());
  if (tag === "select") {
    await control.selectOption({ label: option });
    return;
  }
  await control.scrollIntoViewIfNeeded();
  await control.click();
  const choice = root.getByRole("option", { name: option, exact: true });
  if (!(await appears(choice, 800))) {
    const toggle = control.locator('xpath=following::button[@aria-label="Toggle flyout"][1]');
    if ((await toggle.count()) > 0) await toggle.click();
  }
  if (!(await appears(choice, 3000))) throw new Error(`option "${option}" not found`);
  await choice.first().click();
}

// The location field needs a suggestion clicked, or its hidden latitude/longitude stay empty.
async function fillLocation(root: Frame, control: Locator, value: string): Promise<Result> {
  const city = value.split(",")[0]!.trim();
  await control.scrollIntoViewIfNeeded();
  await control.click();
  await control.pressSequentially(city, { delay: 50 });
  const match = root.getByRole("option").filter({ hasText: new RegExp(escapeRegExp(city), "i") });
  if (await appears(match, 4000)) {
    await match.first().click();
    return { state: "check", note: "confirm the city in the list" };
  }
  return { state: "check", note: "pick your city from the dropdown" };
}

export async function fillGreenhouse(root: Frame, input: FillInput): Promise<Outcome[]> {
  const out: Outcome[] = [];
  const step = async (key: string, label: string, required: boolean, fn: () => Promise<Result>) => {
    try {
      out.push({ key, label, required, ...(await fn()) });
    } catch (e) {
      out.push({ key, label, required, state: "failed", note: firstLine(e) });
    }
  };
  const notFound: Result = { state: "left", note: "couldn't find this field" };

  const parts = input.fullName.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");

  await step("first_name", "First name", true, async () => {
    const c = await findControl(root, "first_name", "First Name");
    if (!c) return notFound;
    await fillText(c, first);
    return { state: "filled" };
  });

  await step("last_name", "Last name", true, async () => {
    if (!last) return { state: "left", note: "your profile has no last name" };
    const c = await findControl(root, "last_name", "Last Name");
    if (!c) return notFound;
    await fillText(c, last);
    return { state: "filled" };
  });

  await step("email", "Email", true, async () => {
    const c = await findControl(root, "email", "Email");
    if (!c) return notFound;
    await fillText(c, input.email);
    await sleep(1200); // the form validates the address in the background
    return { state: "filled" };
  });

  await step("phone", "Phone", true, async () => {
    if (!input.phone) return { state: "left", note: "no phone in your profile" };
    const c = await findControl(root, "phone", "Phone");
    if (!c) return notFound;
    await c.scrollIntoViewIfNeeded();
    await c.fill(input.phone);
    return { state: "check", note: "check the country code" };
  });

  await step("resume", "Resume/CV", true, async () => {
    if (!input.cv) return { state: "left", note: "no CV on file" };
    const candidates = [
      root.locator('input[type="file"]#resume'),
      root.locator('input[type="file"][name="resume"]'),
      root.getByRole("group", { name: /resume|cv/i }).locator('input[type="file"]'),
      root.locator('input[type="file"]'),
    ];
    let target: Locator | null = null;
    for (const c of candidates) {
      if ((await c.count()) > 0) {
        target = c.first();
        break;
      }
    }
    if (!target) return { state: "left", note: "couldn't find the upload field" };
    await target.setInputFiles({ name: input.cv.name, mimeType: input.cv.mimeType, buffer: input.cv.buffer });
    const shown = await appears(root.getByText(input.cv.name, { exact: false }), 12_000);
    return shown ? { state: "filled" } : { state: "check", note: "confirm the CV was attached" };
  });

  for (const q of input.form.questions) {
    await step(q.key, q.label, q.required, async () => {
      if (q.kind === "multiselect" || q.kind === "unsupported") {
        return { state: "left", note: "answer this on the form" };
      }
      const value = q.resolution.value;
      if (q.resolution.source === "none" || !value) return { state: "left", note: "no answer saved" };

      const control = await findControl(root, q.key, q.label);
      if (!control) return notFound;

      if (q.key === "location") return fillLocation(root, control, value);
      if (q.kind === "select") {
        await pickOption(root, control, value);
        return { state: "filled" };
      }
      await fillText(control, value);
      return { state: "filled" };
    });
  }

  const cover = input.form.files.find((f) => /cover/i.test(f.label));
  if (cover) {
    out.push({ key: cover.key, label: cover.label, required: cover.required, state: "left", note: "write this one yourself" });
  }

  // Red = still needs you, amber = filled but worth a look.
  for (const o of out) {
    if (o.state === "filled" || o.key === "resume" || o.key === cover?.key) continue;
    const c = await findControl(root, o.key, o.label);
    if (c) await mark(c, o.state === "check" ? "#d97706" : "#dc2626");
  }
  return out;
}
