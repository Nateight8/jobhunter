import { Providers } from "../../components/providers";
import { ApplicationsPage } from "../../components/applications-page";

// Data comes from the local API, so don't try to prerender at build time.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Providers>
      <ApplicationsPage />
    </Providers>
  );
}
