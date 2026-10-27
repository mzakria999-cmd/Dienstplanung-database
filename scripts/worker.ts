/**
 * Hintergrund-Worker: ruft jede Minute /api/cron auf
 * (geplante Mitteilungen, Dienst-Erinnerungen, E-Mail-Wiederholung, Löschfristen).
 * Alternativ: System-Cron / Kubernetes CronJob mit
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.example.de/api/cron
 */
const url = `${(process.env.APP_INTERNAL_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/cron`;
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET fehlt");
  process.exit(1);
}

async function tick() {
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    const body = await res.text();
    console.log(new Date().toISOString(), res.status, body);
  } catch (e) {
    console.error(new Date().toISOString(), "cron failed", e);
  }
}

tick();
setInterval(tick, 60_000);
