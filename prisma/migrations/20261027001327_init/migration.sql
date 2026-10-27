-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('VOLLZEIT', 'TEILZEIT', 'MINIJOB');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('AKTIV', 'INAKTIV');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('de', 'en');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PLANNED', 'SICK', 'ABSENT', 'VACATION', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING', 'CONFIRMED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'GENERATED', 'COPY', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('VACATION', 'SICK', 'UNEXCUSED', 'DAY_OFF');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('UNAVAILABLE', 'PREFERRED_OFF', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ROTATION');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('CREATED', 'DELETED', 'MODIFIED', 'SICK', 'ABSENT', 'VACATION', 'REPLACEMENT', 'ATTENDANCE', 'RESTORED');

-- CreateEnum
CREATE TYPE "NotifyStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SENT', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NORMAL', 'WICHTIG', 'DRINGEND');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('EMAIL', 'APP', 'BOTH');

-- CreateEnum
CREATE TYPE "RecipientMode" AS ENUM ('ALL', 'SHIFT_F', 'SHIFT_S', 'SHIFT_N', 'SELECTED');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCHEDULE_PUBLISHED', 'SCHEDULE_CHANGED', 'ANNOUNCEMENT', 'URGENT_ANNOUNCEMENT', 'SHIFT_REMINDER', 'SHIFT_OFFER', 'SHIFT_TAKEOVER', 'SCHEDULE_UPDATED', 'SICK_REPORTED', 'REQUEST', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT NOT NULL DEFAULT 'SecurityDienst GmbH',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "logoDataUrl" TEXT,
    "bundesland" TEXT NOT NULL DEFAULT 'BE',
    "minRestHours" INTEGER NOT NULL DEFAULT 11,
    "maxConsecutiveDays" INTEGER NOT NULL DEFAULT 6,
    "maxDailyHours" INTEGER NOT NULL DEFAULT 10,
    "nightStart" TEXT NOT NULL DEFAULT '23:00',
    "nightEnd" TEXT NOT NULL DEFAULT '06:00',
    "overtimeTolerance" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "minijobMaxHours" DOUBLE PRECISION NOT NULL DEFAULT 43,
    "reminderHoursBefore" INTEGER NOT NULL DEFAULT 12,
    "retentionMonthsLogs" INTEGER NOT NULL DEFAULT 24,
    "retentionMonthsNotifications" INTEGER NOT NULL DEFAULT 12,
    "retentionMonthsSickLeave" INTEGER NOT NULL DEFAULT 48,
    "datevBeraterNr" TEXT NOT NULL DEFAULT '',
    "datevMandantNr" TEXT NOT NULL DEFAULT '',
    "datevLohnartWorked" TEXT NOT NULL DEFAULT '100',
    "datevLohnartOvertime" TEXT NOT NULL DEFAULT '200',
    "datevLohnartNight" TEXT NOT NULL DEFAULT '300',
    "datevLohnartSunday" TEXT NOT NULL DEFAULT '310',
    "datevLohnartHoliday" TEXT NOT NULL DEFAULT '320',
    "datevLohnartSick" TEXT NOT NULL DEFAULT '400',
    "datevLohnartVacation" TEXT NOT NULL DEFAULT '500',
    "emailSignature" TEXT NOT NULL DEFAULT 'Ihre Dienstplanung',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "locale" "Locale" NOT NULL DEFAULT 'de',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "totpSecretEnc" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "personnelNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "entryDate" DATE NOT NULL,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'VOLLZEIT',
    "targetHours" DOUBLE PRECISION NOT NULL DEFAULT 160,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'AKTIV',
    "photoDataUrl" TEXT,
    "primaryObjectId" TEXT,
    "allowedShiftCodes" TEXT[] DEFAULT ARRAY['F', 'S', 'N']::TEXT[],
    "availableForReplacement" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeQualification" (
    "employeeId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "validUntil" DATE,

    CONSTRAINT "EmployeeQualification_pkey" PRIMARY KEY ("employeeId","qualificationId")
);

-- CreateTable
CREATE TABLE "SecurityObject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "contactPerson" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiredEarly" INTEGER NOT NULL DEFAULT 1,
    "requiredLate" INTEGER NOT NULL DEFAULT 1,
    "requiredNight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeObject" (
    "employeeId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,

    CONSTRAINT "EmployeeObject_pkey" PRIMARY KEY ("employeeId","objectId")
);

-- CreateTable
CREATE TABLE "ObjectRequiredQualification" (
    "objectId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,

    CONSTRAINT "ObjectRequiredQualification_pkey" PRIMARY KEY ("objectId","qualificationId")
);

-- CreateTable
CREATE TABLE "ShiftType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameDe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShiftType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shiftTypeId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "employeeId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PLANNED',
    "attendance" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "attendanceConfirmedById" TEXT,
    "attendanceConfirmedAt" TIMESTAMP(3),
    "source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isChanged" BOOLEAN NOT NULL DEFAULT false,
    "changeNote" TEXT,
    "replacesAssignmentId" TEXT,
    "sickLeaveId" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "sickLeaveId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "AvailabilityType" NOT NULL,
    "shiftCode" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SickLeave" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "certificate" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "reportedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SickLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthPlan" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "generationReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "monthPlanId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "objectId" TEXT,
    "rotationPattern" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rotationStart" DATE,
    "skipHolidays" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayKey" INTEGER NOT NULL DEFAULT 0,
    "shiftTypeId" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationMember" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "offset" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RotationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleChange" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT,
    "type" "ChangeType" NOT NULL,
    "date" DATE NOT NULL,
    "shiftCode" TEXT NOT NULL,
    "shiftName" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "originalEmployeeId" TEXT,
    "originalEmployeeName" TEXT,
    "newEmployeeId" TEXT,
    "newEmployeeName" TEXT,
    "originalStartAt" TIMESTAMP(3),
    "originalEndAt" TIMESTAMP(3),
    "newStartAt" TIMESTAMP(3),
    "newEndAt" TIMESTAMP(3),
    "originalHours" DOUBLE PRECISION,
    "reason" TEXT NOT NULL DEFAULT '',
    "changedById" TEXT,
    "changedByName" TEXT,
    "notificationStatus" "NotifyStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftOffer" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredById" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "channel" "Channel" NOT NULL DEFAULT 'BOTH',
    "recipientMode" "RecipientMode" NOT NULL,
    "dateFrom" DATE,
    "dateTo" DATE,
    "objectId" TEXT,
    "selectedEmployeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requireAck" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3),
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRecipient" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "emailStatus" "NotifyStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "appNotified" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "AnnouncementRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchBatch" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "year" INTEGER,
    "month" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatchBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "employeeId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "attachmentName" TEXT,
    "attachment" BYTEA,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerId" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_personnelNumber_key" ON "Employee"("personnelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_lastName_firstName_idx" ON "Employee"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Qualification_name_key" ON "Qualification"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityObject_name_key" ON "SecurityObject"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftType_code_key" ON "ShiftType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_replacesAssignmentId_key" ON "Assignment"("replacesAssignmentId");

-- CreateIndex
CREATE INDEX "Assignment_date_idx" ON "Assignment"("date");

-- CreateIndex
CREATE INDEX "Assignment_employeeId_date_idx" ON "Assignment"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Assignment_objectId_date_idx" ON "Assignment"("objectId", "date");

-- CreateIndex
CREATE INDEX "Absence_date_idx" ON "Absence"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Absence_employeeId_date_type_key" ON "Absence"("employeeId", "date", "type");

-- CreateIndex
CREATE INDEX "Availability_date_idx" ON "Availability"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_employeeId_date_type_key" ON "Availability"("employeeId", "date", "type");

-- CreateIndex
CREATE INDEX "SickLeave_fromDate_toDate_idx" ON "SickLeave"("fromDate", "toDate");

-- CreateIndex
CREATE UNIQUE INDEX "MonthPlan_year_month_key" ON "MonthPlan"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_monthPlanId_version_key" ON "PlanVersion"("monthPlanId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RotationMember_templateId_employeeId_key" ON "RotationMember"("templateId", "employeeId");

-- CreateIndex
CREATE INDEX "ScheduleChange_date_idx" ON "ScheduleChange"("date");

-- CreateIndex
CREATE INDEX "ScheduleChange_createdAt_idx" ON "ScheduleChange"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftOffer_assignmentId_employeeId_key" ON "ShiftOffer"("assignmentId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRecipient_announcementId_employeeId_key" ON "AnnouncementRecipient"("announcementId", "employeeId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "EmailLog_status_nextRetryAt_idx" ON "EmailLog"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_primaryObjectId_fkey" FOREIGN KEY ("primaryObjectId") REFERENCES "SecurityObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeQualification" ADD CONSTRAINT "EmployeeQualification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeQualification" ADD CONSTRAINT "EmployeeQualification_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeObject" ADD CONSTRAINT "EmployeeObject_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeObject" ADD CONSTRAINT "EmployeeObject_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "SecurityObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectRequiredQualification" ADD CONSTRAINT "ObjectRequiredQualification_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "SecurityObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectRequiredQualification" ADD CONSTRAINT "ObjectRequiredQualification_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "ShiftType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "SecurityObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_replacesAssignmentId_fkey" FOREIGN KEY ("replacesAssignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_sickLeaveId_fkey" FOREIGN KEY ("sickLeaveId") REFERENCES "SickLeave"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_sickLeaveId_fkey" FOREIGN KEY ("sickLeaveId") REFERENCES "SickLeave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SickLeave" ADD CONSTRAINT "SickLeave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_monthPlanId_fkey" FOREIGN KEY ("monthPlanId") REFERENCES "MonthPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "SecurityObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_shiftTypeId_fkey" FOREIGN KEY ("shiftTypeId") REFERENCES "ShiftType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "SecurityObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationMember" ADD CONSTRAINT "RotationMember_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationMember" ADD CONSTRAINT "RotationMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleChange" ADD CONSTRAINT "ScheduleChange_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOffer" ADD CONSTRAINT "ShiftOffer_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOffer" ADD CONSTRAINT "ShiftOffer_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRecipient" ADD CONSTRAINT "AnnouncementRecipient_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRecipient" ADD CONSTRAINT "AnnouncementRecipient_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DispatchBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
