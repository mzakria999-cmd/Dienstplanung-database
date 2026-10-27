export default function Offline() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Keine Verbindung / Offline</h1>
        <p className="mt-2 text-slate-600">Bitte prüfen Sie Ihre Internetverbindung. Zuletzt geöffnete Seiten sind ggf. weiterhin verfügbar.</p>
      </div>
    </div>
  );
}
