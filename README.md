# SecurityDienst Manager Pro

Dienstplanung & Mitarbeiterverwaltung für Sicherheitsdienste – Next.js · TypeScript · PostgreSQL/Prisma · Auth.js · React-PDF · ExcelJS · PWA.
Oberfläche **Deutsch** (Standard) und **Englisch** (Umschalter oben rechts, pro Benutzer gespeichert).

---

## Schnellstart (lokal)

```bash
cp .env.example .env              # Werte anpassen (AUTH_SECRET, DATA_ENCRYPTION_KEY, CRON_SECRET, Mail)
npm install
npx prisma migrate deploy         # Datenbankschema anlegen
npm run db:seed                   # Schichten F/S/N + Administrator
SEED_DEMO=true npm run db:seed    # optional: 3 Objekte, 18 Demo-Mitarbeiter, Muster-Dienstplan
npm run build && npm start        # http://localhost:3000
npm run worker                    # Hintergrundjobs (separates Terminal)
```

Standard-Login nach dem Seed: `admin@securitydienst.local` / `Admin2026sicher` – das Passwort muss beim ersten Login geändert werden, danach ist (bei `REQUIRE_ADMIN_2FA=true`) die 2FA-Einrichtung Pflicht. Eigene Zugangsdaten: `SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… npm run db:seed`.
Demo-Mitarbeiter: z. B. `max.mueller@example.de`, Schichtleiterin `sabine.wagner@example.de`, Passwort `Demo2026pass`.

### Mit Docker

```bash
cp .env.example .env && docker compose up -d --build          # db, app, worker, tägliche Backups
docker compose exec app npx tsx prisma/seed.ts                  # einmalig
docker compose --profile dev up -d mailpit                      # optional: E-Mail-Testpostfach :8025
```

## Umgebungsvariablen

| Variable | Pflicht | Zweck |
|---|---|---|
| `DATABASE_URL` | ✔ | PostgreSQL-Verbindung |
| `AUTH_SECRET` | ✔ | Signatur der Sitzungen (`openssl rand -base64 32`) |
| `APP_URL` | ✔ | Öffentliche URL (Links in E-Mails) |
| `DATA_ENCRYPTION_KEY` | ✔ | 64 Hex-Zeichen, AES-256-GCM für TOTP-Secrets (`openssl rand -hex 32`) |
| `REQUIRE_ADMIN_2FA` | | `true` (Standard) erzwingt 2FA für Administratoren |
| `MAIL_FROM` | ✔ | Absender, z. B. `Dienstplanung <dienstplan@firma.de>` |
| `RESEND_API_KEY` | eine von beiden | E-Mail über Resend (EU-Region wählen) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | eine von beiden | E-Mail über beliebigen SMTP-Server |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | optional | Web-Push aufs Smartphone (`npm run vapid`) |
| `CRON_SECRET` | ✔ | Schützt `/api/cron` |

**E-Mail einrichten:** Ist weder `RESEND_API_KEY` noch `SMTP_HOST` gesetzt, wird *nichts simuliert* – Versuche werden als „fehlgeschlagen“ protokolliert und unter *PDF & Berichte* angezeigt; die Seite zeigt den Konfigurationsstatus. Fehlgeschlagene Mails werden automatisch bis zu 5× mit wachsendem Abstand wiederholt (oder manuell per Knopf).

## Betrieb

- **Hintergrundjobs** (`npm run worker` oder Cron/K8s-CronJob, minütlich `POST /api/cron` mit `Authorization: Bearer $CRON_SECRET`): geplante Mitteilungen, Dienst-Erinnerungen (X h vorher), E-Mail-Wiederholung, nächtliche DSGVO-Löschfristen.
- **Backups:** `scripts/backup.sh` (pg_dump + gzip, optional GPG-verschlüsselt, Aufbewahrung `BACKUP_KEEP_DAYS`), im Compose-Setup täglich automatisch. Wiederherstellung: `gunzip -c backups/sdm_<datum>.sql.gz | psql "$DATABASE_URL"`.
- **HTTPS:** App hinter einen TLS-Reverse-Proxy stellen (z. B. Caddy: `dienstplan.firma.de { reverse_proxy app:3000 }`). HSTS u. a. Sicherheits-Header setzt die App selbst.
- **EU-Hosting:** z. B. Hetzner, IONOS, OVH, STACKIT (App + PostgreSQL in DE); Resend mit EU-Region oder SMTP eines deutschen Anbieters. Festplattenverschlüsselung der DB ist Aufgabe des Hostings.

## Funktionsumfang (alle Phasen umgesetzt)

| Phase | Inhalt | Wo |
|---|---|---|
| 1 | Schema, Auth.js (Credentials, bcrypt, Sperre nach 5 Fehlversuchen), Rollen Admin/Schichtleiter/Mitarbeiter, TOTP-2FA, Mitarbeiterverwaltung (Personalnummer eindeutig, Foto, Objektfreigaben, Qualifikationen), DE/EN | `/mitarbeiter`, `/profil` |
| 2 | Drei Schichten (F grün 06–14, S gelb 14–22, N orange 22–06, Zeiten anpassbar), Monatsplan mit Drag-and-Drop, Kopieren (Tag/Woche/Monat), F/S/N/FREI/K/FT/U, Tagesansicht mit Anwesenheitsbestätigung, Schichtseiten, automatische Stundenberechnung | `/dienstplanung`, `/dienstplanung/tag`, `/schicht/F|S|N` |
| 3 | Muster-Dienstpläne (Tag/Woche/Monat/Rotation), **MONATSDIENSTPLAN AUTOMATISCH ERSTELLEN** (Verfügbarkeit, Abwesenheit, bestehende Dienste, Sollstunden, Überschneidung, 11 h Ruhezeit, max. Folgetage, Objektfreigabe, Minijob-Grenze), Entwurf → Freigabe | `/muster` |
| 4 | **KRANKMELDUNG EINTRAGEN**, Originaldienst bleibt als KRANK erhalten, offene Ersatzschicht, **VERFÜGBARE MITARBEITER FÜR DIENSTÜBERNAHME** (FREI zuerst, Telefon, Stunden, Anrufen/E-Mail/Dienst anbieten/Zuweisen), Annahme/Ablehnung durch Mitarbeiter, rote ÄNDERUNG-Markierung, Historie | `/krankmeldungen`, `/angebote`, `/aenderungen` |
| 5 | E-Mail (Resend/SMTP), A4-PDF je Mitarbeiter (`Dienstplan_November_2026_SD001.pdf`), **DIENSTPLAN AN ALLE MITARBEITER SENDEN** + Früh/Spät/Nacht/Ausgewählte (ohne Doppelversand), jederzeit vor Monatsbeginn, Vorab-Prüfung, Ergebnis je Empfänger, Wiederholung, Versionen & Archiv, automatische Änderungs-Mails mit aktualisiertem PDF | `/berichte` |
| 6 | Mitteilungen an NUR F/S/N (heute/morgen/Datum/Zeitraum, optional Objekt), ALLE, BESTIMMTE; Priorität, Versandart, später senden, Bestätigungsdialog, Lesebestätigung, Glocke mit rotem Zähler, Web-Push | `/mitteilungen`, `/mitteilungen/gesendet`, `/meine-mitteilungen` |
| 7 | Stundenübersicht (Soll, geplant, gearbeitet, krank, Urlaub, noch zu planen, Über-/Minus, Nacht, Sonntag, Feiertag), **MONATSABRECHNUNG ERSTELLEN** als PDF/XLSX/CSV/DATEV LODAS – nur bestätigte Anwesenheit zählt | `/stunden`, `/abrechnung` |
| 8 | Objektverwaltung (Sollbesetzung F/S/N, Ansprechpartner, Pflichtqualifikationen, eingewiesene Mitarbeiter, Objekt-Dienstplan), objektbezogene Ersatzvorschläge | `/objekte` |
| 9 | Responsive/Mobil, installierbare PWA (Manifest, Service Worker, Offline-Seite, Push), Audit-Log, DSGVO-Auskunft & Anonymisierung, Löschfristen, Sicherheits-Header, Tests, Docker | — |

### Wichtige fachliche Regeln (wie umgesetzt)

- **Zeiten** werden als Berliner Wandzeit gespeichert („floating time“): 22:00 Mo – 06:00 Di = 8 h. In den zwei Zeitumstellungsnächten zählt die Nachtschicht nominal 8 h.
- **Stundenarten:** *Geplant* = ursprünglich geplante Dienste (inkl. später krank); *Gearbeitet* = nur **bestätigte** Anwesenheit (Ist-Zeiten möglich); *Krank* = Stunden der ausgefallenen Dienste (Lohnausfallprinzip, Krankheit an freien Tagen = 0 h); *Über-/Minusstunden* = (gearbeitet + krank + Urlaub) − Soll. Nachtzeit (Standard 23–6 Uhr, ArbZG) ist einstellbar, z. B. 20–6 Uhr für §3b EStG. *Zuschlagsrelevant* zählt jede Stunde mit Nacht-/Sonntags-/Feiertagsanteil einmal.
- **Krank vs. Fehltag:** K (bezahlt, Entgeltfortzahlung) und FT (unentschuldigt, unbezahlt) sind getrennte Status. Diagnosen werden nicht gespeichert (Eingaben mit „Diagnose/ICD“ werden abgelehnt).
- **Feiertage** aller 16 Bundesländer (Ostern nach Gauß), Bundesland in den Einstellungen.
- **Regelverstöße** (Ruhezeit, Überschneidung, Folgetage, Höchstdauer) blockieren standardmäßig; der Admin kann bewusst „Trotzdem speichern“ – wird im Audit-Log dokumentiert.
- **Sichtbarkeit:** Mitarbeiter sehen nur eigene, *veröffentlichte* Pläne und eigene Daten; Schichtleiter sehen Pläne, Kontaktdaten und Krankmeldungen, aber keine Abrechnung/Einstellungen.

## Projektstruktur

```
prisma/schema.prisma        Datenmodell (Mitarbeiter, Objekte, Schichten, Dienste, Krank, Muster, Mitteilungen, Logs …)
src/lib/                    Reine Fachlogik (getestet): time, holidays, hours, rules, scheduler, replacement, i18n
src/server/                 Services: schedule, sick, generator, dispatch, announcements, payroll, mail, pdf, cron, queries
src/actions/                Server Actions (zod-validiert, rollengeprüft, Audit)
src/app/(app)/…             Seiten; src/app/api/… PDF-, Export-, Cron-, Push-, Notification-Routen
public/sw.js, manifest      PWA
scripts/                    worker.ts (Cron), backup.sh
tests/                      Vitest (Stunden, Nacht/Sonntag/Feiertag, Ruhezeit, Auto-Planer, Ersatzranking, i18n)
```

## Tests

```bash
npm test          # 21 Unit-Tests der Fachlogik
npm run typecheck
```

Zusätzlich wurde der gesamte Ablauf im Browser (Playwright) gegen eine echte PostgreSQL-DB und einen echten SMTP-Server durchgespielt: Login + Pflicht-Passwortwechsel, 2FA, Auto-Planung Okt./Nov., Freigabe, Versand an 18 Mitarbeiter mit individuellen PDFs, Krankmeldung → Ersatzvorschlag → Angebot → Zuweisung → Änderungs-Mails an beide, Mitteilung nur an Frühschicht mit Lesebestätigung, Mitarbeiter-Ansicht am iPhone-Viewport, Zugriffsschutz (403), Abrechnungsexporte.

## Bekannte Grenzen / bewusste Entscheidungen

- **Kalender:** eigenes Monatsraster statt FullCalendar (die Mitarbeiter×Tage-Ansicht „Resource Timeline“ ist dort kostenpflichtig). UI-Komponenten sind im shadcn/ui-Stil selbst implementiert (ohne Radix-Abhängigkeit).
- Regel-Detailmeldungen (z. B. „Ruhezeit nur 8 h …“) sind serverseitig deutsch, auch in der englischen Oberfläche. E-Mails und Dienstplan-PDFs folgen der Sprache des Empfängers; die Abrechnung ist für die Buchhaltung deutsch.
- Massenversand läuft synchron im Request (18 Mitarbeiter ≈ 3,5 s inkl. PDFs); für mehrere hundert Mitarbeiter empfiehlt sich ein Job-Queue-Worker.
- Krankmeldungen erfassen Dienste nach **Kalendertag des Dienstbeginns**.
- Das DATEV-LODAS-Format und die Lohnarten-Nummern bitte mit dem Steuerberater abstimmen (Lohnarten in den Einstellungen konfigurierbar).
- Kein SMS/WhatsApp-Versand; Push benötigt VAPID-Schlüssel (iOS: nur als installierte PWA ab iOS 16.4).
