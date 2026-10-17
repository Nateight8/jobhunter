import { ValidationError } from "./errors";

type Maybe<T> = T | null | undefined;

// undefined = field not provided (leave unchanged), null = clear it.

export function str(name: string, v: Maybe<string>, max = 500): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = v.trim();
  if (!s) return null;
  if (s.length > max) throw new ValidationError(`${name} is too long (max ${max} characters)`);
  return s;
}

export function requiredStr(name: string, v: string, max = 500): string {
  const s = str(name, v, max);
  if (!s) throw new ValidationError(`${name} is required`);
  return s;
}

export function email(name: string, v: Maybe<string>) {
  const s = str(name, v, 254);
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw new ValidationError(`${name} must be a valid email address`);
  }
  return s;
}

export function phone(name: string, v: Maybe<string>) {
  const s = str(name, v, 30);
  if (s && !/^[+()\d\s.-]{5,30}$/.test(s)) {
    throw new ValidationError(`${name} must be a valid phone number`);
  }
  return s;
}

export function url(name: string, v: Maybe<string>) {
  const s = str(name, v, 500);
  if (!s) return s;
  const full = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    if (!new URL(full).hostname.includes(".")) throw new Error();
  } catch {
    throw new ValidationError(`${name} must be a valid URL`);
  }
  return full;
}

export function int(name: string, v: Maybe<number>, min: number, max: number) {
  if (v === undefined || v === null) return v;
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new ValidationError(`${name} must be a whole number between ${min} and ${max}`);
  }
  return v;
}

export function list(name: string, v: Maybe<string[]>, maxItems: number, maxLen: number): string[] {
  const out: string[] = [];
  for (const raw of v ?? []) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > maxLen) throw new ValidationError(`${name}: an item is too long (max ${maxLen})`);
    out.push(s);
  }
  if (out.length > maxItems) throw new ValidationError(`${name}: too many items (max ${maxItems})`);
  return out;
}

// Accepts 2024-05 or 2024-05-17, stores the first of the month.
export function month(name: string, v: Maybe<string>): string | null | undefined {
  const s = str(name, v, 10);
  if (!s) return s;
  const m = /^(\d{4})-(0[1-9]|1[0-2])(-\d{2})?$/.exec(s);
  if (!m) throw new ValidationError(`${name} must look like 2024-05`);
  return `${m[1]}-${m[2]}-01`;
}
