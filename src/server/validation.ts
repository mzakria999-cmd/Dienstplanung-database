import { z } from "zod";

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum (JJJJ-MM-TT)");
export const timeStr = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Uhrzeit (HH:MM)");
export const id = z.string().min(1).max(40);
export const year = z.coerce.number().int().min(2000).max(2100);
export const month = z.coerce.number().int().min(1).max(12);

export const employeeSchema = z.object({
  id: id.optional(),
  firstName: z.string().trim().min(1, "Pflichtfeld").max(80),
  lastName: z.string().trim().min(1, "Pflichtfeld").max(80),
  personnelNumber: z.string().trim().min(1, "Pflichtfeld").max(20).regex(/^[A-Za-z0-9_-]+$/, "nur Buchstaben, Ziffern, - und _"),
  email: z.string().trim().toLowerCase().email("ungültige E-Mail").max(200),
  phone: z.string().trim().max(40).regex(/^[+0-9 ()/-]*$/, "ungültige Telefonnummer").default(""),
  entryDate: dateStr,
  employmentType: z.enum(["VOLLZEIT", "TEILZEIT", "MINIJOB"]),
  targetHours: z.coerce.number().min(0).max(300),
  status: z.enum(["AKTIV", "INAKTIV"]),
  primaryObjectId: z.string().max(40).optional().nullable().transform((v) => v || null),
  role: z.enum(["ADMIN", "SUPERVISOR", "EMPLOYEE"]).default("EMPLOYEE"),
  allowedShiftCodes: z.array(z.enum(["F", "S", "N"])).default(["F", "S", "N"]),
  availableForReplacement: z.boolean().default(true),
  objectIds: z.array(id).default([]),
  qualificationIds: z.array(id).default([]),
  photoDataUrl: z
    .string()
    .max(1_500_000, "Foto zu groß (max. ~1 MB)")
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Nur PNG/JPEG/WebP")
    .optional()
    .nullable(),
  password: z.string().min(10, "mind. 10 Zeichen").max(200).optional().or(z.literal("")),
});

export const passwordSchema = z
  .string()
  .min(10, "Mindestens 10 Zeichen")
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Buchstaben und Ziffern erforderlich");
