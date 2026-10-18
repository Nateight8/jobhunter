import { Suspense } from "react";
import { Providers } from "../../components/providers";
import { ProfilePage } from "../../components/profile/profile-page";

// Data comes from the local API, so don't try to prerender at build time.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Providers>
      <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading…</p>}>
        <ProfilePage />
      </Suspense>
    </Providers>
  );
}
