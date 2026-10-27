/**
 * Optional: Hintergrundjobs im App-Prozess (INTERNAL_CRON=true), z. B. für Hosting ohne separaten Worker
 * (Render, Railway …). Mit docker compose übernimmt der Worker-Container diese Aufgabe.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
