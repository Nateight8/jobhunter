import { Suspense } from "react";
import { BackButton, JobDetail } from "../../components/job-detail";
import { Providers } from "../../components/providers";

// Data comes from the local API, so don't try to prerender at build time.
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ jobid: string }> }) {
  const { jobid } = await params;
  return (
    <Providers>
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <BackButton />
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <JobDetail id={jobid} />
        </Suspense>
      </main>
    </Providers>
  );
}
