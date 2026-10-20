import { claimNext, markStale, setStatus, sleep } from "./db";
import { processRun } from "./process";

async function main() {
  await markStale();
  console.log("Runner ready. Waiting for auto-fill requests. Press Ctrl+C to stop.");

  for (;;) {
    const run = await claimNext();
    if (!run) {
      await sleep(1500);
      continue;
    }
    try {
      await processRun(run);
    } catch (e) {
      console.error(e);
      await setStatus(run.id, "failed", e instanceof Error ? e.message : "Something went wrong.");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
