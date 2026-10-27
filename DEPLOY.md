# Deployment – Schritt für Schritt (EU-Server, ca. 30 Minuten)

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
