# Schnellste Testumgebung: Render.com (ohne Terminal, auch vom iPad)

1. Bei **https://render.com** mit dem GitHub-Konto anmelden („Sign in with GitHub“) und Render den Zugriff auf
   das Repository **Dienstplanung-database** erlauben.
2. Diesen Link öffnen: **https://render.com/deploy?repo=https://github.com/mzakria999-cmd/Dienstplanung-database**
3. Folgende Felder ausfüllen (alles andere ist vorbelegt, Geheimschlüssel werden automatisch erzeugt):

   | Feld | Wert (Beispiel Test) |
   |---|---|
   | `SEED_ADMIN_EMAIL` | `mzakm999@gmail.com` |
   | `SEED_ADMIN_PASSWORD` | ein Passwort, mind. 10 Zeichen mit Ziffern, z. B. `Test2026sicher` |
   | `SEED_DEMO_EMAIL_BASE` | `mzakm999@gmail.com` → Testmitarbeiter erhalten `mzakm999+max@gmail.com` usw. |
   | `MAIL_FROM` | `Dienstplanung <mzakm999@gmail.com>` |
   | `SMTP_USER` | `mzakm999@gmail.com` |
   | `SMTP_PASSWORD` | Gmail-**App-Passwort** (16 Zeichen, ohne Leerzeichen; myaccount.google.com/apppasswords) |

4. **Deploy Blueprint** antippen. Nach ca. 5–10 Minuten ist die App unter `https://dienstplanung-xxxx.onrender.com`
   erreichbar (Adresse steht im Render-Dashboard). Anmelden mit `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`,
   Demo-Mitarbeiter mit Passwort `Demo2026pass`.

Hinweise zum kostenlosen Render-Tarif:
- Die App schläft nach 15 Minuten ohne Aufrufe ein; der erste Aufruf danach dauert ca. 1 Minute.
- Die kostenlose Datenbank läuft nach 30 Tagen ab (für Tests ausreichend).
- Render blockiert im kostenlosen Tarif ggf. ausgehende E-Mail-Ports (SMTP). Erscheinen E-Mails unter
  *PDF & Berichte* als fehlgeschlagen, den Web-Service auf **Starter** umstellen (Settings → Instance Type).
- Demo-Daten (`SEED_DEMO=true`) werden bei jedem Start ergänzt, aber nie doppelt angelegt. Für den Echtbetrieb
  `SEED_DEMO` auf `false` setzen.

---

# Eigener Server – Schritt für Schritt (EU-Server, ca. 30 Minuten)

Ergebnis: Die App läuft unter `https://dienstplan.ihre-firma.de` mit automatischem HTTPS-Zertifikat,
PostgreSQL-Datenbank, Hintergrundjobs (Erinnerungen, geplante Mitteilungen, E-Mail-Wiederholung) und täglichen Backups.

## 1. Server mieten
Empfehlung: **Hetzner Cloud** (Deutschland, DSGVO) → Server **CX22** (2 vCPU, 4 GB RAM, ca. 5 €/Monat),
Image **Ubuntu 24.04**, Standort Nürnberg oder Falkenstein. SSH-Schlüssel hinterlegen.
(Gleichwertig: IONOS, Strato, netcup, OVH – jeder Linux-Server mit mind. 2 GB RAM.)

## 2. Domain auf den Server zeigen lassen
Beim Domain-Anbieter einen **A-Eintrag** anlegen: `dienstplan.ihre-firma.de` → IP-Adresse des Servers.
(Ein paar Minuten warten, bis der Eintrag aktiv ist.)

## 3. Server vorbereiten
```bash
ssh root@<SERVER-IP>
curl -fsSL https://get.docker.com | sh          # Docker installieren
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
git clone https://github.com/mzakria999-cmd/Dienstplanung-database.git /opt/dienstplanung
cd /opt/dienstplanung
```
Ist das Repository privat, beim `git clone` als Passwort einen GitHub-Personal-Access-Token verwenden.

## 4. Konfiguration (.env)
```bash
cp .env.example .env
sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(openssl rand -base64 32)\"|" .env
sed -i "s|^DATA_ENCRYPTION_KEY=.*|DATA_ENCRYPTION_KEY=\"$(openssl rand -hex 32)\"|" .env
sed -i "s|^CRON_SECRET=.*|CRON_SECRET=\"$(openssl rand -hex 24)\"|" .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\"$(openssl rand -hex 16)\"|" .env
nano .env
```
In `nano` anpassen (speichern: Strg+O, Enter, Strg+X):
- `DOMAIN="dienstplan.ihre-firma.de"`
- `APP_URL="https://dienstplan.ihre-firma.de"`
- `MAIL_FROM="Dienstplanung <dienstplan@ihre-firma.de>"`
- E-Mail: **entweder** `RESEND_API_KEY` **oder** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
  (die SMTP-Daten Ihres E-Mail-Postfachs, z. B. IONOS: `smtp.ionos.de`, Port `587`).

## 5. Starten
```bash
docker compose up -d --build                         # erster Start dauert ca. 5 Minuten
docker compose exec -e SEED_ADMIN_EMAIL=chef@ihre-firma.de -e SEED_ADMIN_PASSWORD='SicheresPasswort2026' app npx tsx prisma/seed.ts
```
Jetzt `https://dienstplan.ihre-firma.de` öffnen, mit der Admin-E-Mail anmelden und die
**Zwei-Faktor-Authentifizierung** einrichten (Pflicht für Administratoren). Danach unter *Einstellungen*
Firmenname, Logo und Bundesland, unter *Objektverwaltung* die Objekte und unter *Mitarbeiter* das Personal anlegen.

## 6. Optional: Push-Benachrichtigungen aufs Handy
```bash
docker compose exec app npx web-push generate-vapid-keys
```
Die beiden Schlüssel als `NEXT_PUBLIC_VAPID_PUBLIC_KEY` und `VAPID_PRIVATE_KEY` in `.env` eintragen, dann
`docker compose up -d --build`.

## Betrieb
| Aufgabe | Befehl |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f app` |
| Update auf neue Version | `git pull && docker compose up -d --build` (Datenbank-Migrationen laufen automatisch) |
| Backups | liegen täglich in `/opt/dienstplanung/backups/` (30 Tage); zusätzlich extern sichern, z. B. Hetzner Storage Box |
| Backup einspielen | `gunzip -c backups/sdm_<datum>.sql.gz \| docker compose exec -T db psql -U sdm sdm` |
| Neustart | `docker compose restart` |

**Hinweis:** Die Datenbank ist nicht von außen erreichbar, die App nur über HTTPS (Port 80 leitet automatisch auf 443 um).
