import { MemoryPage } from "../../components/memory-page";
import { Providers } from "../../components/providers";

// Data comes from the local API, so don't try to prerender at build time.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Providers>
      <MemoryPage />
    </Providers>
  );
}
