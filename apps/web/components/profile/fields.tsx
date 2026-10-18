"use client";

import type { ReactNode } from "react";

export const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";

export function Txt(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
  placeholder?: string;
  rows?: number;
}) {
  const { label, value, onChange, hint, type = "text", placeholder, rows } = props;
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {rows ? (
        <textarea
          className={inputClass}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={inputClass}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Section(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-md border p-4">
      <div>
        <h2 className="font-semibold">{props.title}</h2>
        {props.description && <p className="text-sm text-muted-foreground">{props.description}</p>}
      </div>
      {props.children}
    </section>
  );
}

const small = "rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40";

export function ListEditor<T>(props: {
  items: T[];
  onChange: (items: T[]) => void;
  empty: () => T;
  addLabel: string;
  render: (item: T, set: (patch: Partial<T>) => void) => ReactNode;
}) {
  const { items, onChange, empty, addLabel, render } = props;
  const move = (i: number, d: number) => {
    const next = [...items];
    const [item] = next.splice(i, 1);
    next.splice(i + d, 0, item!);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="space-y-3 rounded-md border p-3">
          {render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          <div className="flex gap-2">
            <button type="button" className={small} disabled={i === 0} onClick={() => move(i, -1)}>
              Move up
            </button>
            <button
              type="button"
              className={small}
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            >
              Move down
            </button>
            <button type="button" className={small} onClick={() => onChange(items.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" className={small} onClick={() => onChange([...items, empty()])}>
        {addLabel}
      </button>
    </div>
  );
}
