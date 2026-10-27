import { runAllJobs } from "./server/cron";

if (process.env.INTERNAL_CRON === "true") {
  const tick = () => runAllJobs().catch((e) => console.error("cron", e));
  setTimeout(tick, 30_000);
  setInterval(tick, 60_000);
  console.log("Interne Hintergrundjobs aktiv (jede Minute)");
}
