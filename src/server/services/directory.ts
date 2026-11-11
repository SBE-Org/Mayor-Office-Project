import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePerm, type Actor } from "@/server/access";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { FACILITY_TYPES } from "@/shared/constants";

const opt = z.string().trim().optional().transform((v) => v || undefined);
const code = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,20}$/, "Code: 2-20 letters, digits, - or _");

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Enter the office name").max(150), // office name
  subCityId: opt,
  headName: opt, // name of the head of office representative
  subCityMayor: opt, // stored on the sub-city, shown for every office in it
  phone: opt,
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  isActive: z.boolean().default(true),
});
export const subCitySchema = z.object({ code, name: z.string().trim().min(2).max(100), mayorName: opt, isActive: z.boolean().default(true) });
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

/** Office codes are generated automatically: OFF-001, OFF-002, ... (existing codes are kept). */
async function nextOfficeCode() {
  for (;;) {
    const c = await prisma.counter.upsert({ where: { key: "office-code" }, create: { key: "office-code", value: 1 }, update: { value: { increment: 1 } } });
    const code = `OFF-${String(c.value).padStart(3, "0")}`;
    if (!(await prisma.department.findUnique({ where: { code } }))) return code;
  }
}

export async function saveDepartment(actor: Actor, id: string | null, raw: unknown) {
  requirePerm(actor, "department.manage");
  const { subCityMayor, ...data } = departmentSchema.parse(raw);
  if (data.subCityId && !(await prisma.subCity.findUnique({ where: { id: data.subCityId } }))) throw new AppError("Unknown sub-city.");
  const r = await uniqueGuard(async () =>
    id
      ? await prisma.department.update({ where: { id }, data: { ...data, subCityId: data.subCityId ?? null, headName: data.headName ?? null } })
      : await prisma.department.create({ data: { ...data, code: await nextOfficeCode(), type: "OFFICE" } }),
  );
  if (data.subCityId) await prisma.subCity.update({ where: { id: data.subCityId }, data: { mayorName: subCityMayor ?? null } });
  await audit(prisma, actor.id, id ? "DEPARTMENT_UPDATE" : "DEPARTMENT_CREATE", "Department", r.id, { ...data, code: r.code, subCityMayor });
}
export async function saveSubCity(actor: Actor, id: string | null, raw: unknown) {
  requirePerm(actor, "department.manage");
  const data = subCitySchema.parse(raw);
  const row = { ...data, mayorName: data.mayorName ?? null };
  const r = await uniqueGuard(() => (id ? prisma.subCity.update({ where: { id }, data: row }) : prisma.subCity.create({ data: row })));
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

// ---------------------------------------------------------------- woredas & kebeles

const names = (raw: string) =>
  [...new Set(raw.split(/[,\n]/).map((n) => n.trim()).filter(Boolean))].map((n) => {
    if (n.length > 60) throw new AppError(`"${n.slice(0, 20)}…" is too long (max 60 characters).`);
    return n;
  });

/** Adds one or more woredas (comma or line separated) to a sub-city. */
export async function addWoredas(actor: Actor, subCityId: string, raw: string) {
  requirePerm(actor, "department.manage");
  const list = names(raw);
  if (!list.length) throw new AppError("Enter at least one woreda name.");
  if (!(await prisma.subCity.findUnique({ where: { id: subCityId } }))) throw new AppError("Unknown sub-city.");
  const existing = new Set((await prisma.woreda.findMany({ where: { subCityId } })).map((w) => w.name.toLowerCase()));
  const fresh = list.filter((n) => !existing.has(n.toLowerCase()));
  for (const name of fresh) await prisma.woreda.create({ data: { subCityId, name } });
  await audit(prisma, actor.id, "WOREDA_CREATE", "SubCity", subCityId, { names: fresh });
  return { added: fresh.length, skipped: list.length - fresh.length };
}

/** Adds one or more kebeles (comma or line separated) to a woreda. */
export async function addKebeles(actor: Actor, woredaId: string, raw: string) {
  requirePerm(actor, "department.manage");
  const list = names(raw);
  if (!list.length) throw new AppError("Enter at least one kebele name.");
  if (!(await prisma.woreda.findUnique({ where: { id: woredaId } }))) throw new AppError("Unknown woreda.");
  const existing = new Set((await prisma.kebele.findMany({ where: { woredaId } })).map((k) => k.name.toLowerCase()));
  const fresh = list.filter((n) => !existing.has(n.toLowerCase()));
  for (const name of fresh) await prisma.kebele.create({ data: { woredaId, name } });
  await audit(prisma, actor.id, "KEBELE_CREATE", "Woreda", woredaId, { names: fresh });
  return { added: fresh.length, skipped: list.length - fresh.length };
}

const placeSchema = z.object({ name: z.string().trim().min(1, "Enter a name").max(60), isActive: z.boolean() });

export async function updateWoreda(actor: Actor, id: string, raw: unknown) {
  requirePerm(actor, "department.manage");
  const data = placeSchema.parse(raw);
  await uniqueGuard(() => prisma.woreda.update({ where: { id }, data }));
  await audit(prisma, actor.id, "WOREDA_UPDATE", "Woreda", id, data);
}
export async function updateKebele(actor: Actor, id: string, raw: unknown) {
  requirePerm(actor, "department.manage");
  const data = placeSchema.parse(raw);
  await uniqueGuard(() => prisma.kebele.update({ where: { id }, data }));
  await audit(prisma, actor.id, "KEBELE_UPDATE", "Kebele", id, data);
}

export type LocationTree = { id: string; name: string; woredas: { id: string; name: string; kebeles: { id: string; name: string }[] }[] }[];

/** Active sub-cities with their active woredas and kebeles, for the cascading drop-downs. */
export async function locationTree(): Promise<LocationTree> {
  const subs = await prisma.subCity.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { woredas: { where: { isActive: true }, orderBy: { name: "asc" }, include: { kebeles: { where: { isActive: true }, orderBy: { name: "asc" } } } } },
  });
  return subs.map((s) => ({ id: s.id, name: s.name, woredas: s.woredas.map((w) => ({ id: w.id, name: w.name, kebeles: w.kebeles.map((k) => ({ id: k.id, name: k.name })) })) }));
}

/**
 * Checks a sub-city / woreda / kebele combination against the administrator's lists.
 * Woreda and kebele are stored by name on the citizen record.
 */
export async function assertLocation(loc: { subCityId?: string; woreda?: string; kebele?: string }) {
  const { subCityId, woreda, kebele } = loc;
  if (!subCityId) {
    if (woreda || kebele) throw new AppError("Choose the sub-city first.");
    return;
  }
  const sc = await prisma.subCity.findFirst({ where: { id: subCityId, isActive: true }, include: { woredas: { where: { isActive: true }, include: { kebeles: { where: { isActive: true } } } } } });
  if (!sc) throw new AppError("Unknown sub-city.");
  if (!woreda) {
    if (kebele) throw new AppError("Choose the woreda first.");
    return;
  }
  const w = sc.woredas.find((x) => x.name === woreda);
  if (!w) throw new AppError(`Woreda "${woreda}" is not registered under ${sc.name}.`);
  if (kebele && !w.kebeles.some((k) => k.name === kebele)) throw new AppError(`Kebele "${kebele}" is not registered under woreda ${w.name}.`);
}

/** Baseline case categories for every installation (code, English, Afaan Oromoo, Amharic, deadline days). Edit under Case categories. */
export const BASE_CATEGORIES: [string, string, string, string, number][] = [
  ["LAND", "Land and property", "Lafaa fi qabeenya", "መሬት እና ንብረት", 20],
  ["HOUSING", "Housing", "Mana jireenyaa", "ቤት", 20],
  ["EMPLOYMENT", "Employment and enterprise", "Hojii fi dhaabbilee", "ሥራ እና ኢንተርፕራይዝ", 15],
  ["SOCIAL", "Social support", "Deeggarsa hawaasummaa", "ማኅበራዊ ድጋፍ", 10],
  ["SERVICE", "Administrative / public-service complaint", "Komii tajaajila bulchiinsaa", "የአስተዳደር / የሕዝብ አገልግሎት ቅሬታ", 10],
  ["COMMUNITY", "Community development", "Misooma hawaasaa", "የማኅበረሰብ ልማት", 30],
  ["INFRA", "Infrastructure (roads, water, electricity)", "Misooma bu'uuraa (karaa, bishaan, ibsaa)", "መሠረተ ልማት (መንገድ፣ ውኃ፣ መብራት)", 30],
  ["INTERVENTION", "Request for intervention", "Gaaffii giddu-galummaa", "የጣልቃ ገብነት ጥያቄ", 10],
  ["OTHER", "Other", "Kan biraa", "ሌላ", 15],
];

/** Creates the baseline categories when the table is completely empty. Returns how many were created. */
export async function ensureBaseCategories() {
  if (await prisma.caseCategory.count()) return 0;
  for (const [code, name, nameOm, nameAm, days] of BASE_CATEGORIES) {
    await prisma.caseCategory.upsert({ where: { code }, create: { code, name, nameOm, nameAm, defaultDeadlineDays: days }, update: {} });
  }
  return BASE_CATEGORIES.length;
}

export async function activeCategories() {
  const list = () => prisma.caseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const r = await list();
  if (r.length) return r;
  return (await ensureBaseCategories()) ? list() : r;
}
export const activeSubCities = () => prisma.subCity.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
export const activeDepartments = () => prisma.department.findMany({ where: { isActive: true }, include: { subCity: true }, orderBy: [{ type: "asc" }, { name: "asc" }] });
export const activeFacilities = () => prisma.facility.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
