"use client";

import { useState } from "react";
import Link from "next/link";
import { useApolloClient, useMutation, useSuspenseQuery } from "@apollo/client/react";
import { uploadCv } from "../../lib/api";
import {
  CONFIRM_MUTATION,
  DISCARD_MUTATION,
  EXTRACT_MUTATION,
  PROFILE_QUERY,
} from "../../lib/profile-queries";
import { fromDraft, fromProfile, toInput, type FormState } from "./form-state";
import { ProfileForm } from "./profile-form";

const MISSING_LABELS: Record<string, string> = {
  fullName: "name",
  email: "email",
  phone: "phone",
  country: "country",
  authorizedRegions: "regions you can work in",
  cv: "a CV file",
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export function ProfilePage() {
  const client = useApolloClient();
  const { data } = useSuspenseQuery(PROFILE_QUERY);
  const profile = data.profile;

  const [extract] = useMutation(EXTRACT_MUTATION);
  const [confirm, { loading: saving }] = useMutation(CONFIRM_MUTATION);
  const [discard] = useMutation(DISCARD_MUTATION);

  const [busy, setBusy] = useState<"uploading" | "reading" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const draft = profile.draft;
  const readyDraft = draft?.status === "ready" && draft.data ? draft : null;
  const failedDraft = draft?.status === "failed" ? draft : null;
  const defaultCv = profile.documents.find((d) => d.kind === "CV" && d.isDefault) ?? null;

  const initial: FormState = readyDraft?.data
    ? fromDraft(readyDraft.data, profile)
    : fromProfile(profile);
  const formKey = readyDraft ? `draft-${readyDraft.id}` : `profile-${profile.confirmedAt ?? "new"}`;

  const refresh = () => client.refetchQueries({ include: [PROFILE_QUERY] });

  async function runExtraction(documentId: string) {
    setBusy("reading");
    try {
      await extract({ variables: { documentId } });
    } catch (e) {
      setNotice(`${errorMessage(e)} You can fill in the form by hand.`);
    } finally {
      await refresh();
      setBusy(null);
    }
  }

  async function onFile(file: File) {
    setNotice(null);
    setSaved(false);
    setBusy("uploading");
    try {
      const { id } = await uploadCv(file);
      await runExtraction(id);
    } catch (e) {
      setNotice(errorMessage(e));
      setBusy(null);
    }
  }

  async function onSave(state: FormState) {
    setSaveError(null);
    setSaved(false);
    try {
      await confirm({ variables: { input: toInput(state), draftId: readyDraft?.id ?? null } });
      setSaved(true);
    } catch (e) {
      setSaveError(errorMessage(e));
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Your profile</h1>
        <Link href="/" className="text-sm underline">
          Back to jobs
        </Link>
      </header>

      {!profile.readiness.ready && (
        <p className="rounded-md border p-3 text-sm">
          Still needed to apply:{" "}
          {profile.readiness.missing.map((m) => MISSING_LABELS[m] ?? m).join(", ")}.
        </p>
      )}

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="font-semibold">Your CV</h2>
        {defaultCv ? (
          <p className="text-sm">
            <a href={defaultCv.downloadUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {defaultCv.filename}
            </a>{" "}
            <span className="text-muted-foreground">({Math.ceil(defaultCv.sizeBytes / 1024)} KB)</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No CV uploaded yet.</p>
        )}
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={busy !== null}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFile(file);
          }}
          className="block text-sm"
        />
        <p className="text-xs text-muted-foreground">
          PDF or DOCX, up to 10 MB. Your CV is sent to Google Gemini to read it. Nothing is saved to
          your profile until you review the result and press Save.
        </p>
        {busy === "uploading" && <p className="text-sm">Uploading…</p>}
        {busy === "reading" && (
          <p className="text-sm">Reading your CV with Gemini. This can take up to 30 seconds…</p>
        )}
        {notice && <p className="text-sm text-destructive">{notice}</p>}
      </section>

      {failedDraft && (
        <section className="space-y-2 rounded-md border p-4">
          <p className="text-sm text-destructive">
            Couldn&apos;t read your CV: {failedDraft.error ?? "unknown error"}
          </p>
          <div className="flex gap-2">
            {failedDraft.documentId && (
              <button
                type="button"
                disabled={busy !== null}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                onClick={() => void runExtraction(failedDraft.documentId!)}
              >
                Try again
              </button>
            )}
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
              onClick={() => void discard({ variables: { id: failedDraft.id } })}
            >
              Fill in manually
            </button>
          </div>
        </section>
      )}

      {readyDraft && (
        <section className="space-y-2 rounded-md border p-4">
          <p className="text-sm">
            Review what was read from your CV, fix anything wrong, fill the missing fields, then
            save.
            {profile.confirmedAt && " Saving replaces your current profile with this version."}
          </p>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
            onClick={() => void discard({ variables: { id: readyDraft.id } })}
          >
            Discard this result
          </button>
        </section>
      )}

      <ProfileForm
        key={formKey}
        initial={initial}
        saving={saving}
        error={saveError}
        saved={saved}
        onSave={(state) => void onSave(state)}
      />
    </main>
  );
}
