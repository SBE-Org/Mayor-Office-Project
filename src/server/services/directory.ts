import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePerm, type Actor } from "@/server/access";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { FACILITY_TYPES } from "@/shared/constants";

const opt = z.string().trim().optional().transform((v) => v || undefined);
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/, "Code: 2-20 letters, digits, - or _");

export const departmentSchema = z.object({
  code,
  name: z.string().trim().min(2).max(150),
  type: z.enum(["DEPARTMENT", "SUBCITY_ADMIN", "OFFICE"]),
  subCityId: opt,
  headName: opt,
  phone: opt,
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  isActive: z.boolean().default(true),
});
export const subCitySchema = z.object({ code, name: z.string().trim().min(2).max(100), isActive: z.boolean().default(true) });
export const categorySchema = z.object({
  code,
  name: z.string().trim().min(2).max(150),
  nameOm: opt,
  nameAm: opt,
  description: opt,
  defaultDepartmentId: opt,
  defaultDeadlineDays: z.coerce.number().int().min(1).max(365),
  isActive: z.boolean().default(true),
});
export const facilitySchema = z.object({
  name: z.string().trim().min(2).max(150),
  type: z.enum(FACILITY_TYPES),
  capacity: z.coerce.number().int().min(1).max(10000),
  location: opt,
  description: opt,
  managerId: opt,
  isActive: z.boolean().default(true),
});

async function uniqueGuard<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") throw new AppError("A record with this code or name already exists.");
    throw e;
  }
}

export async function saveDepartment(actor: Actor, id: string | null, raw: unknown) {
  requirePerm(actor, "department.manage");
  const data = departmentSchema.parse(raw);
  const r = await uniqueGuard(() => (id ? prisma.department.update({ where: { id }, data: { ...data, subCityId: data.subCityId ?? null } }) : prisma.department.create({ data })));
  await audit(prisma, actor.id, id ? "DEPARTMENT_UPDATE" : "DEPARTMENT_CREATE", "Department", r.id, data);
}
export async function saveSubCity(actor: Actor, id: string | null, raw: unknown) {
  requirePerm(actor, "department.manage");
  const data = subCitySchema.parse(raw);
  const r = await uniqueGuard(() => (id ? prisma.subCity.update({ where: { id }, data }) : prisma.subCity.create({ data })));
  await audit(prisma, actor.id, id ? "SUBCITY_UPDATE" : "SUBCITY_CREATE", "SubCity", r.id, data);
}
export async function saveCategory(actor: Actor, id: string | null, raw: unknown) {
  requirePerm(actor, "category.manage");
  const data = categorySchema.parse(raw);
  const r = await uniqueGuard(() =>
    id ? prisma.caseCategory.update({ where: { id }, data: { ...data, defaultDepartmentId: data.defaultDepartmentId ?? null } }) : prisma.caseCategory.create({ data }),
  );
  await audit(prisma, actor.id, id ? "CATEGORY_UPDATE" : "CATEGORY_CREATE", "CaseCategory", r.id, data);
}
export async function saveFacility(actor: Actor, id: string | null, raw: unknown) {
  requirePerm(actor, "facility.manage");
  const data = facilitySchema.parse(raw);
  const r = await uniqueGuard(() => (id ? prisma.facility.update({ where: { id }, data: { ...data, managerId: data.managerId ?? null } }) : prisma.facility.create({ data })));
  await audit(prisma, actor.id, id ? "FACILITY_UPDATE" : "FACILITY_CREATE", "Facility", r.id, data);
}

export const activeCategories = () => prisma.caseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
export const activeSubCities = () => prisma.subCity.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
export const activeDepartments = () => prisma.department.findMany({ where: { isActive: true }, include: { subCity: true }, orderBy: [{ type: "asc" }, { name: "asc" }] });
export const activeFacilities = () => prisma.facility.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
