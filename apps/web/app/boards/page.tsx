import { Suspense } from "react";
import { BoardsPage } from "../../components/boards-page";
import { Providers } from "../../components/providers";

// Data comes from the local API, so don't try to prerender at build time.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Providers>
      <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading…</p>}>
        <BoardsPage />
      </Suspense>
    </Providers>
  );
}
