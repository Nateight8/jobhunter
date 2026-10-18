"use client";

import { useState } from "react";
import {
  emptyEducation,
  emptyExperience,
  emptyProject,
  missingRequired,
  type FormState,
} from "./form-state";
import { ListEditor, Section, Txt } from "./fields";

export function ProfileForm(props: {
  initial: FormState;
  saving: boolean;
  error: string | null;
  saved: boolean;
  onSave: (state: FormState) => void;
}) {
  const [f, setF] = useState(props.initial);
  const [localError, setLocalError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  function submit() {
    const missing = missingRequired(f);
    if (missing.length) {
      setLocalError(`Still needed: ${missing.join(", ")}`);
      return;
    }
    setLocalError(null);
    props.onSave(f);
  }

  const error = localError ?? props.error;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Section title="Basics">
        <div className="grid gap-3 sm:grid-cols-2">
          <Txt label="Full name *" value={f.fullName} onChange={(v) => set("fullName", v)} />
          <Txt label="Email *" type="email" value={f.email} onChange={(v) => set("email", v)} />
          <Txt label="Phone *" value={f.phone} onChange={(v) => set("phone", v)} placeholder="+234 ..." />
          <Txt label="City" value={f.city} onChange={(v) => set("city", v)} />
        </div>
        <Txt label="Headline" value={f.headline} onChange={(v) => set("headline", v)} />
        <Txt label="Summary" rows={4} value={f.summary} onChange={(v) => set("summary", v)} />
      </Section>

      <Section
        title="Eligibility"
        description="Two questions a CV can't answer. They decide which jobs you can actually take."
      >
        <Txt
          label="Where do you live? (country) *"
          value={f.country}
          onChange={(v) => set("country", v)}
        />
        <Txt
          label="Which regions can you work in without visa sponsorship? *"
          value={f.authorizedRegions}
          onChange={(v) => set("authorizedRegions", v)}
          hint="Comma separated, e.g. Nigeria, Africa, Worldwide"
        />
      </Section>

      <Section title="Links">
        <div className="grid gap-3 sm:grid-cols-3">
          <Txt label="LinkedIn" value={f.linkedinUrl} onChange={(v) => set("linkedinUrl", v)} />
          <Txt label="GitHub" value={f.githubUrl} onChange={(v) => set("githubUrl", v)} />
          <Txt label="Portfolio" value={f.portfolioUrl} onChange={(v) => set("portfolioUrl", v)} />
        </div>
        <ListEditor
          items={f.links}
          onChange={(v) => set("links", v)}
          empty={() => ({ label: "", url: "" })}
          addLabel="Add another link"
          render={(l, up) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Txt label="Label" value={l.label} onChange={(v) => up({ label: v })} />
              <Txt label="URL" value={l.url} onChange={(v) => up({ url: v })} />
            </div>
          )}
        />
      </Section>

      <Section title="Experience">
        <ListEditor
          items={f.experiences}
          onChange={(v) => set("experiences", v)}
          empty={emptyExperience}
          addLabel="Add experience"
          render={(e, up) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Txt label="Company" value={e.company} onChange={(v) => up({ company: v })} />
                <Txt label="Title" value={e.title} onChange={(v) => up({ title: v })} />
                <Txt label="Location" value={e.location} onChange={(v) => up({ location: v })} />
                <Txt
                  label="Start"
                  type="month"
                  placeholder="YYYY-MM"
                  value={e.startDate}
                  onChange={(v) => up({ startDate: v })}
                />
                {!e.isCurrent && (
                  <Txt
                    label="End"
                    type="month"
                    placeholder="YYYY-MM"
                    value={e.endDate}
                    onChange={(v) => up({ endDate: v })}
                  />
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={e.isCurrent}
                  onChange={(ev) => up({ isCurrent: ev.target.checked })}
                />
                I currently work here
              </label>
              <Txt
                label="Bullets"
                rows={4}
                value={e.bullets}
                onChange={(v) => up({ bullets: v })}
                hint="One per line"
              />
              <Txt
                label="Technologies"
                value={e.technologies}
                onChange={(v) => up({ technologies: v })}
                hint="Comma separated"
              />
            </>
          )}
        />
      </Section>

      <Section title="Education">
        <ListEditor
          items={f.education}
          onChange={(v) => set("education", v)}
          empty={emptyEducation}
          addLabel="Add education"
          render={(e, up) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <Txt label="School" value={e.school} onChange={(v) => up({ school: v })} />
              <Txt label="Degree" value={e.degree} onChange={(v) => up({ degree: v })} />
              <Txt label="Field" value={e.field} onChange={(v) => up({ field: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Txt
                  label="Start"
                  type="month"
                  placeholder="YYYY-MM"
                  value={e.startDate}
                  onChange={(v) => up({ startDate: v })}
                />
                <Txt
                  label="End"
                  type="month"
                  placeholder="YYYY-MM"
                  value={e.endDate}
                  onChange={(v) => up({ endDate: v })}
                />
              </div>
            </div>
          )}
        />
      </Section>

      <Section title="Projects">
        <ListEditor
          items={f.projects}
          onChange={(v) => set("projects", v)}
          empty={emptyProject}
          addLabel="Add project"
          render={(p, up) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Txt label="Name" value={p.name} onChange={(v) => up({ name: v })} />
                <Txt label="URL" value={p.url} onChange={(v) => up({ url: v })} />
              </div>
              <Txt
                label="Description"
                rows={2}
                value={p.description}
                onChange={(v) => up({ description: v })}
              />
              <Txt
                label="Bullets"
                rows={3}
                value={p.bullets}
                onChange={(v) => up({ bullets: v })}
                hint="One per line"
              />
              <Txt
                label="Technologies"
                value={p.technologies}
                onChange={(v) => up({ technologies: v })}
                hint="Comma separated"
              />
            </>
          )}
        />
      </Section>

      <Section title="Skills">
        <Txt
          label="Skills"
          rows={3}
          value={f.skills}
          onChange={(v) => set("skills", v)}
          hint="Comma or line separated"
        />
      </Section>

      <div className="sticky bottom-0 flex items-center gap-3 border-t bg-background py-3">
        <button
          type="submit"
          disabled={props.saving}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {props.saving ? "Saving…" : "Save profile"}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && props.saved && <p className="text-sm text-muted-foreground">Saved.</p>}
      </div>
    </form>
  );
}
