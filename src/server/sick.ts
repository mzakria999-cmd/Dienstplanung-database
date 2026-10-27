import "server-only";
import { prisma } from "@/lib/db";
import { rankReplacements, type DayStatus, type ReplacementInput } from "@/lib/replacement";
import { checkConflicts } from "@/lib/rules";
import { addDays, dateKey, DAY_MS, durationHours, formatDate, parseDateKey } from "@/lib/time";
import { maxHoursFor } from "@/lib/scheduler";
import { AppError } from "./errors";
import { audit } from "./audit";
import { getSettings, ruleSettings, appUrl } from "./settings";
import type { SessionUser } from "./session";
import { notifyEmployees, notifyRoles } from "./notify";
import { queueEmail, sendMany } from "./mail";
import { offerMail } from "./email-templates";
import { plannedHoursInclDrafts } from "./hours-service";
import { assertEditable, assignmentInclude, conflictsFor, createOpenSlotFor, fullName, isPublishedDate, notifyChanges, recordChange, shiftInfo, type ChangeNotice } from "./schedule";

export interface SickLeaveInput {
  employeeId: string;
  fromDate: string;
  toDate: string;
  certificate?: boolean;
  note?: string;
}

/**
 * KRANKMELDUNG EINTRAGEN
 * 1. Mitarbeiter als krank markieren  2. aus aktiver Besetzung entfernen  3. Originaldienst bleibt erhalten
 * 4. Status KRANK  5. als nicht gearbeitet erfasst  6. Stunden werden automatisch neu berechnet
 * 7. für jeden ausgefallenen Dienst wird eine offene Schicht zur Neubesetzung angelegt
 */
export async function registerSickLeave(input: SickLeaveInput, actor: SessionUser) {
  const from = parseDateKey(input.fromDate);
  const to = parseDateKey(input.toDate);
  if (to < from) throw new AppError("Enddatum liegt vor dem Startdatum", "End date is before start date");
  if ((to.getTime() - from.getTime()) / DAY_MS > 366) throw new AppError("Zeitraum zu lang", "Period too long");
  await assertEditable(from);
  const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) throw new AppError("Mitarbeiter nicht gefunden", "Employee not found");
  if (actor.role === "EMPLOYEE" && actor.employeeId !== input.employeeId) throw new AppError("Keine Berechtigung", "Not allowed");
  if (/diagnos|befund|icd/i.test(input.note ?? "")) throw new AppError("Bitte keine medizinischen Angaben/Diagnosen eintragen (DSGVO).", "Please do not enter medical details/diagnoses (GDPR).");

  const overlapping = await prisma.sickLeave.findFirst({ where: { employeeId: input.employeeId, revokedAt: null, fromDate: { lte: to }, toDate: { gte: from } } });
  if (overlapping) throw new AppError("Für diesen Zeitraum existiert bereits eine Krankmeldung", "A sick note already exists for this period");

  const sickLeave = await prisma.sickLeave.create({
    data: {
      employeeId: input.employeeId,
      fromDate: from,
      toDate: to,
      certificate: !!input.certificate,
      note: input.note ?? "",
      confirmed: actor.role !== "EMPLOYEE",
      reportedById: actor.id,
    },
  });

  // Dienste im Zeitraum (inkl. Nachtschicht am Vortag, die in den Zeitraum reicht, wird nicht erfasst – Kalendertag zählt)
  const shifts = await prisma.assignment.findMany({ where: { employeeId: input.employeeId, date: { gte: from, lte: to }, status: "PLANNED" }, include: assignmentInclude, orderBy: { startAt: "asc" } });
  const openSlots = [];
  const changeIds: string[] = [];
  const notices: ChangeNotice[] = [];
  for (const a of shifts) {
    const [updated, open] = await prisma.$transaction(async (tx) => {
      const u = await tx.assignment.update({ where: { id: a.id }, data: { status: "SICK", attendance: "PENDING", sickLeaveId: sickLeave.id, actualStartAt: null, actualEndAt: null }, include: assignmentInclude });
      const o = await createOpenSlotFor(a, tx);
      return [u, o] as const;
    });
    openSlots.push(open);
    const published = (await isPublishedDate(a.date)) && !a.isDraft;
    const ch = await recordChange({ type: "SICK", assignment: updated, originalEmployee: employee, originalStartAt: a.startAt, originalEndAt: a.endAt, reason: "Krankmeldung", actor, notify: published });
    changeIds.push(ch.id);
    if (published) notices.push({ kind: "sick", employeeId: employee.id, assignment: updated });
  }

  // Tage ohne Dienst als krank erfassen (0 bezahlte Stunden – Lohnausfallprinzip)
  const shiftDays = new Set(shifts.map((s) => dateKey(s.date)));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (shiftDays.has(dateKey(d))) continue;
    await prisma.absence.upsert({
      where: { employeeId_date_type: { employeeId: employee.id, date: d, type: "SICK" } },
      update: { sickLeaveId: sickLeave.id },
      create: { employeeId: employee.id, date: d, type: "SICK", hours: 0, sickLeaveId: sickLeave.id, createdById: actor.id },
    });
  }

  await audit(actor.id, "SICK_LEAVE_CREATE", "SickLeave", sickLeave.id, { employeeId: employee.id, from: input.fromDate, to: input.toDate, shifts: shifts.length });
  await notifyRoles(
    ["ADMIN", "SUPERVISOR"],
    {
      type: "SICK_REPORTED",
      title: `Krankmeldung: ${fullName(employee)}`,
      body: `${formatDate(from)} – ${formatDate(to)} · ${shifts.length} Dienst(e) offen – Ersatz erforderlich`,
      link: `/krankmeldungen?id=${sickLeave.id}`,
    },
    actor.id,
  );
  await notifyChanges(notices, changeIds);
  return { sickLeave, openSlots, affected: shifts.length };
}

export async function confirmSickLeave(id: string, actor: SessionUser) {
  await prisma.sickLeave.update({ where: { id }, data: { confirmed: true } });
  await audit(actor.id, "SICK_LEAVE_CONFIRM", "SickLeave", id);
}

/** Krankmeldung zurücknehmen: noch nicht neu besetzte Dienste werden wiederhergestellt */
export async function revokeSickLeave(id: string, actor: SessionUser) {
  const sl = await prisma.sickLeave.findUnique({ where: { id }, include: { assignments: { include: { replacedBy: true, ...assignmentInclude } } } });
  if (!sl || sl.revokedAt) throw new AppError("Krankmeldung nicht gefunden", "Sick note not found");
  let restored = 0;
  let kept = 0;
  for (const a of sl.assignments) {
    if (a.replacedBy?.employeeId) {
      kept++;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      if (a.replacedBy) await tx.assignment.delete({ where: { id: a.replacedBy.id } });
      await tx.assignment.update({ where: { id: a.id }, data: { status: "PLANNED", sickLeaveId: null } });
    });
    await recordChange({ type: "RESTORED", assignment: a, newEmployee: a.employee, reason: "Krankmeldung zurückgenommen", actor, notify: false });
    restored++;
  }
  await prisma.absence.deleteMany({ where: { sickLeaveId: id } });
  await prisma.sickLeave.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit(actor.id, "SICK_LEAVE_REVOKE", "SickLeave", id, { restored, kept });
  return { restored, kept };
}

// ------------------------------------------------------------------ Ersatzvorschläge

/**
 * VERFÜGBARE MITARBEITER FÜR DIENSTÜBERNAHME – sortiert, verfügbare (FREI) zuerst.
 */
export async function replacementCandidates(openAssignmentId: string) {
  const slot = await prisma.assignment.findUnique({ where: { id: openAssignmentId }, include: { ...assignmentInclude, replacesAssignment: { include: { employee: true } }, offers: true } });
  if (!slot) throw new AppError("Dienst nicht gefunden", "Shift not found");
  const settings = await getSettings();
  const rs = ruleSettings(settings);
  const year = slot.date.getUTCFullYear();
  const month = slot.date.getUTCMonth() + 1;
  const span = (settings.maxConsecutiveDays + 1) * DAY_MS;
  const winFrom = new Date(slot.startAt.getTime() - span);
  const winTo = new Date(slot.endAt.getTime() + span);

  const [employees, required, windows, absences, availability, planned] = await Promise.all([
    prisma.employee.findMany({ where: { status: "AKTIV" }, include: { objectQualifications: true, qualifications: true } }),
    prisma.objectRequiredQualification.findMany({ where: { objectId: slot.objectId } }),
    prisma.assignment.findMany({ where: { status: "PLANNED", attendance: { not: "NO_SHOW" }, employeeId: { not: null }, startAt: { lt: winTo }, endAt: { gt: winFrom } }, include: { shiftType: true } }),
    prisma.absence.findMany({ where: { date: slot.date } }),
    prisma.availability.findMany({ where: { date: slot.date } }),
    plannedHoursInclDrafts(year, month),
  ]);
  const sickOnDay = await prisma.assignment.findMany({ where: { date: slot.date, status: { in: ["SICK", "VACATION", "ABSENT"] }, employeeId: { not: null } }, select: { employeeId: true, status: true } });
  const shiftHoursValue = durationHours(slot.startAt, slot.endAt, slot.breakMinutes);
  const day = dateKey(slot.date);

  const inputs: ReplacementInput[] = employees
    .filter((e) => e.id !== slot.replacesAssignment?.employeeId)
    .map((e) => {
      const qualified =
        (e.primaryObjectId === slot.objectId || e.objectQualifications.some((q) => q.objectId === slot.objectId)) &&
        required.every((r) => e.qualifications.some((q) => q.qualificationId === r.qualificationId && (!q.validUntil || q.validUntil >= slot.date)));
      const own = windows.filter((w) => w.employeeId === e.id).map((w) => ({ id: w.id, date: dateKey(w.date), startAt: w.startAt, endAt: w.endAt, breakMinutes: w.breakMinutes, code: w.shiftType.code }));
      const issues = checkConflicts({ date: day, startAt: slot.startAt, endAt: slot.endAt, breakMinutes: slot.breakMinutes }, own, rs).filter((i) => i.code !== "DOUBLE_DAY");
      let dayStatus: DayStatus = "FREI";
      const ab = absences.find((a) => a.employeeId === e.id);
      const st = sickOnDay.find((s) => s.employeeId === e.id);
      const av = availability.filter((a) => a.employeeId === e.id);
      if (ab?.type === "SICK" || st?.status === "SICK") dayStatus = "KRANK";
      else if (ab?.type === "VACATION" || st?.status === "VACATION") dayStatus = "URLAUB";
      else if (ab?.type === "UNEXCUSED" || st?.status === "ABSENT") dayStatus = "FEHLTAG";
      else if (av.some((a) => a.type === "UNAVAILABLE" && (!a.shiftCode || a.shiftCode === slot.shiftType.code))) dayStatus = "NICHT_VERFUEGBAR";
      else if (own.some((w) => w.date === day)) dayStatus = "IM_DIENST";
      else if (av.some((a) => a.type === "PREFERRED_OFF") || ab?.type === "DAY_OFF") dayStatus = "WUNSCHFREI";
      return {
        employeeId: e.id,
        name: fullName(e),
        personnelNumber: e.personnelNumber,
        phone: e.phone,
        email: e.email,
        active: e.status === "AKTIV",
        availableForReplacement: e.availableForReplacement,
        qualified,
        dayStatus,
        issues,
        plannedHours: Math.round((planned.get(e.id) ?? 0) * 100) / 100,
        targetHours: e.targetHours,
        maxHours: maxHoursFor({ targetHours: e.targetHours, employmentType: e.employmentType } as never, { ...rs, overtimeTolerance: Math.max(settings.overtimeTolerance, 24), minijobMaxHours: settings.minijobMaxHours }),
      };
    });
  const ranked = rankReplacements(inputs, shiftHoursValue);
  const offers = new Map(slot.offers.map((o) => [o.employeeId, o.status]));
  return { slot, candidates: ranked.map((c) => ({ ...c, offerStatus: offers.get(c.employeeId) ?? null })), shiftHours: shiftHoursValue };
}

// ------------------------------------------------------------------ Dienst anbieten / Annahme

export async function offerShift(openAssignmentId: string, employeeId: string, actor: SessionUser, message = "") {
  const slot = await prisma.assignment.findUnique({ where: { id: openAssignmentId }, include: assignmentInclude });
  if (!slot || slot.employeeId) throw new AppError("Dienst ist nicht (mehr) offen", "Shift is no longer open");
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: true } });
  if (!emp) throw new AppError("Mitarbeiter nicht gefunden", "Employee not found");
  const offer = await prisma.shiftOffer.upsert({
    where: { assignmentId_employeeId: { assignmentId: slot.id, employeeId } },
    update: { status: "OFFERED", respondedAt: null, offeredById: actor.id, message },
    create: { assignmentId: slot.id, employeeId, offeredById: actor.id, message },
  });
  const locale = emp.user?.locale ?? "de";
  const info = shiftInfo(slot, locale);
  await notifyEmployees([employeeId], {
    type: "SHIFT_OFFER",
    title: locale === "de" ? "Dienstangebot" : "Shift offer",
    body: `${formatDate(slot.date, locale)} · ${info.shiftName} ${info.start}–${info.end} · ${info.objectName}`,
    link: "/angebote",
  });
  if (emp.email) {
    const settings = await getSettings();
    const log = await queueEmail({ ...offerMail(locale, settings, info, appUrl("/angebote")), to: emp.email, employeeId });
    await sendMany([log.id]);
  }
  await audit(actor.id, "SHIFT_OFFER", "Assignment", slot.id, { employeeId });
  return offer;
}

export async function respondOffer(offerId: string, accept: boolean, actor: SessionUser) {
  const offer = await prisma.shiftOffer.findUnique({ where: { id: offerId }, include: { employee: true, assignment: { include: assignmentInclude } } });
  if (!offer || offer.employeeId !== actor.employeeId) throw new AppError("Angebot nicht gefunden", "Offer not found");
  if (offer.status !== "OFFERED") throw new AppError("Angebot wurde bereits beantwortet", "Offer already answered");
  if (offer.assignment.employeeId) throw new AppError("Dienst wurde bereits vergeben", "Shift already assigned");
  await prisma.shiftOffer.update({ where: { id: offerId }, data: { status: accept ? "ACCEPTED" : "REJECTED", respondedAt: new Date() } });
  await notifyRoles(["ADMIN", "SUPERVISOR"], {
    type: "REQUEST",
    title: `${fullName(offer.employee)} hat das Dienstangebot ${accept ? "ANGENOMMEN" : "abgelehnt"}`,
    body: `${formatDate(offer.assignment.date)} · ${offer.assignment.shiftType.nameDe} · ${offer.assignment.object.name}`,
    link: `/krankmeldungen?slot=${offer.assignmentId}`,
  });
  await audit(actor.id, accept ? "OFFER_ACCEPT" : "OFFER_REJECT", "ShiftOffer", offerId);
}

/**
 * Ersatz zuweisen (AUTOMATISCHE DIENSTPLANÄNDERUNG):
 * offene Schicht -> Ersatzmitarbeiter, rot markiert ("ÄNDERUNG"), Historie, neue PDFs, Benachrichtigung beider Mitarbeiter.
 */
export async function assignReplacement(openAssignmentId: string, employeeId: string, actor: SessionUser, force = false) {
  const slot = await prisma.assignment.findUnique({ where: { id: openAssignmentId }, include: { ...assignmentInclude, replacesAssignment: { include: assignmentInclude } } });
  if (!slot) throw new AppError("Dienst nicht gefunden", "Shift not found");
  if (slot.employeeId) throw new AppError("Dienst ist bereits besetzt", "Shift is already assigned");
  await assertEditable(slot.date);
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp || emp.status !== "AKTIV") throw new AppError("Mitarbeiter ist nicht aktiv", "Employee is not active");
  const issues = (await conflictsFor(employeeId, slot.date, slot.startAt, slot.endAt, slot.breakMinutes)).filter((i) => i.code !== "DOUBLE_DAY" || !force);
  const blocking = issues.filter((i) => i.severity === "error");
  if (blocking.length && !force) throw new AppError(`Konflikt: ${blocking.map((i) => i.message).join("; ")}`, `Conflict: ${blocking.map((i) => i.message).join("; ")}`, { issues, needsForce: true });

  const original = slot.replacesAssignment;
  const note = original?.employee ? `Vertretung für ${fullName(original.employee)}` : "Dienstübernahme";
  const published = (await isPublishedDate(slot.date)) && !slot.isDraft;
  const updated = await prisma.assignment.update({
    where: { id: slot.id },
    data: { employeeId, isChanged: published, changeNote: note, source: original ? "REPLACEMENT" : slot.source },
    include: assignmentInclude,
  });
  await prisma.shiftOffer.updateMany({ where: { assignmentId: slot.id, employeeId }, data: { status: "ASSIGNED" } });
  await prisma.shiftOffer.updateMany({ where: { assignmentId: slot.id, employeeId: { not: employeeId }, status: { in: ["OFFERED", "ACCEPTED"] } }, data: { status: "WITHDRAWN" } });

  const change = await recordChange({
    type: "REPLACEMENT",
    assignment: updated,
    originalEmployee: original?.employee ?? null,
    newEmployee: emp,
    originalStartAt: original?.startAt ?? slot.startAt,
    originalEndAt: original?.endAt ?? slot.endAt,
    reason: original ? `${original.status === "SICK" ? "Krankheit" : original.status === "VACATION" ? "Urlaub" : "Ausfall"} – ${note}` : "Offene Schicht besetzt",
    actor,
    notify: published,
  });
  await audit(actor.id, "REPLACEMENT_ASSIGN", "Assignment", slot.id, { employeeId, originalEmployeeId: original?.employeeId ?? null, force });

  if (published) {
    const notices: ChangeNotice[] = [{ kind: "new", employeeId, assignment: updated, note }];
    await notifyChanges(notices, [change.id]);
    if (original?.employeeId) {
      await notifyEmployees([original.employeeId], {
        type: "SCHEDULE_UPDATED",
        title: "Aktualisierter Dienstplan",
        body: `Ihr Dienst am ${formatDate(slot.date)} (${slot.shiftType.nameDe}) wurde von ${fullName(emp)} übernommen. Status: Krank / Nicht gearbeitet.`,
        link: `/mein-dienstplan?year=${slot.date.getUTCFullYear()}&month=${slot.date.getUTCMonth() + 1}`,
      });
    }
  }
  return updated;
}
