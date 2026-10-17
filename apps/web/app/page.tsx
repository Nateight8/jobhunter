import { Suspense } from "react";
import { Feed } from "../components/feed";
import { Providers } from "../components/providers";

// Data comes from the local API, so don't try to prerender at build time.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Providers>
      <Suspense fallback={null}>
        <Feed />
      </Suspense>
    </Providers>
  );
}
