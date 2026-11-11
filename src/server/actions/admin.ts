"use server";
import { bool, formObject, run, str, type ActionResult } from "@/server/action";
import { requireActor } from "@/server/auth/session";
import * as acc from "@/server/services/accounts";
import * as dir from "@/server/services/directory";
import { AppError } from "@/server/errors";

type A = ActionResult | null;

const staffInput = (fd: FormData) => ({
  ...formObject(fd, ["fullName", "email", "phone", "title", "roleCode", "departmentId"]),
  acceptsAppointments: bool(fd, "acceptsAppointments"),
});

export async function createUserAction(_: A, fd: FormData) {
  const a = await requireActor("user.manage");
  return run(async () => {
    const { user, tempPassword } = await acc.createStaffUser(a, staffInput(fd));
    return `Account created for ${user.email}.\nTemporary password: ${tempPassword}\nShare it securely; the user must change it at first sign-in.`;
  }, ["/staff/admin/users"]);
}

export async function updateUserAction(id: string, _: A, fd: FormData) {
  const a = await requireActor("user.manage");
  return run(() => acc.updateStaffUser(a, id, { ...staffInput(fd), isActive: bool(fd, "isActive") }).then(() => "User updated."), ["/staff/admin/users"]);
}

export async function resetPasswordAction(id: string, _: A) {
  const a = await requireActor("user.manage");
  return run(async () => `Temporary password: ${await acc.resetUserPassword(a, id)}\nAll sessions of this user were signed out.`, ["/staff/admin/users"]);
}

export async function createCitizenAccountAction(_: A, fd: FormData) {
  const a = await requireActor("user.manage");
  return run(async () => {
    const { user, tempPassword, linkedCases } = await acc.createCitizenAccount(a, {
      ...formObject(fd, ["fullName", "email", "phone", "subCityId", "woreda", "kebele", "gender"]),
      preferredLanguage: str(fd, "preferredLanguage") || "en",
    });
    return [
      `Case-owner account created for ${user.fullName} (${user.email}).`,
      `Temporary password: ${tempPassword}`,
      linkedCases ? `Linked to ${linkedCases} existing case${linkedCases === 1 ? "" : "s"} registered under the same name and phone.` : "",
      "Share the password securely; the case owner must change it at first sign-in.",
    ].filter(Boolean).join("\n");
  }, ["/staff/admin/users", "/staff/admin"]);
}

export async function setCitizenActiveAction(id: string, isActive: boolean, _: A) {
  const a = await requireActor("user.manage");
  return run(() => acc.setCitizenAccountActive(a, id, isActive).then(() => (isActive ? "Account activated." : "Account deactivated.")), ["/staff/admin/users"]);
}

export async function saveRolePermissionsAction(roleCode: string, _: A, fd: FormData) {
  const a = await requireActor("role.manage");
  return run(async () => {
    const codes = fd.getAll("perm").filter((v): v is string => typeof v === "string");
    const r = await acc.setRolePermissions(a, roleCode, codes);
    if (!r.added && !r.removed) return "No changes to save.";
    return `Permissions saved: ${r.added} granted, ${r.removed} revoked. Users with this role get the new access on their next page load.`;
  }, ["/staff/admin/roles"]);
}

export async function resetRolePermissionsAction(roleCode: string, _: A) {
  const a = await requireActor("role.manage");
  const { DEFAULT_ROLE_PERMISSIONS } = await import("@/shared/permissions");
  return run(async () => {
    const defaults = DEFAULT_ROLE_PERMISSIONS[roleCode as keyof typeof DEFAULT_ROLE_PERMISSIONS];
    if (!defaults) throw new AppError("Unknown role.");
    const r = await acc.setRolePermissions(a, roleCode, defaults);
    return r.added || r.removed ? `Defaults restored: ${r.added} granted, ${r.removed} revoked.` : "This role already has the default permissions.";
  }, ["/staff/admin/roles"]);
}

export async function saveDepartmentAction(id: string | null, _: A, fd: FormData) {
  const a = await requireActor("department.manage");
  return run(
    () =>
      dir
        .saveDepartment(a, id, { ...formObject(fd, ["name", "subCityId", "headName", "subCityMayor", "phone", "email"]), isActive: id ? bool(fd, "isActive") : true })
        .then(() => (id ? "Office saved." : "Office added. Its code was generated automatically.")),
    ["/staff/directory", "/staff/locations"],
  );
}
export async function saveSubCityAction(id: string | null, _: A, fd: FormData) {
  const a = await requireActor("department.manage");
  return run(
    () => dir.saveSubCity(a, id, { ...formObject(fd, ["code", "name", "mayorName"]), isActive: id ? bool(fd, "isActive") : true }).then(() => "Sub-city saved."),
    ["/staff/directory", "/staff/locations"],
  );
}
const added = (what: string, r: { added: number; skipped: number }) => `${r.added} ${what}${r.added === 1 ? "" : "s"} added.${r.skipped ? ` ${r.skipped} already existed.` : ""}`;
export async function addWoredasAction(subCityId: string, _: A, fd: FormData) {
  const a = await requireActor("department.manage");
  return run(async () => added("woreda", await dir.addWoredas(a, subCityId, str(fd, "names"))), ["/staff/locations"]);
}
export async function addKebelesAction(woredaId: string, _: A, fd: FormData) {
  const a = await requireActor("department.manage");
  return run(async () => added("kebele", await dir.addKebeles(a, woredaId, str(fd, "names"))), ["/staff/locations"]);
}
export async function updateWoredaAction(id: string, _: A, fd: FormData) {
  const a = await requireActor("department.manage");
  return run(() => dir.updateWoreda(a, id, { name: str(fd, "name"), isActive: bool(fd, "isActive") }).then(() => "Woreda saved."), ["/staff/locations"]);
}
export async function updateKebeleAction(id: string, _: A, fd: FormData) {
  const a = await requireActor("department.manage");
  return run(() => dir.updateKebele(a, id, { name: str(fd, "name"), isActive: bool(fd, "isActive") }).then(() => "Kebele saved."), ["/staff/locations"]);
}
export async function saveCategoryAction(id: string | null, _: A, fd: FormData) {
  const a = await requireActor("category.manage");
  return run(
    () => dir.saveCategory(a, id, { ...formObject(fd, ["code", "name", "nameOm", "nameAm", "description", "defaultDepartmentId", "defaultDeadlineDays"]), isActive: id ? bool(fd, "isActive") : true }).then(() => "Category saved."),
    ["/staff/admin/categories"],
  );
}
export async function saveFacilityAction(id: string | null, _: A, fd: FormData) {
  const a = await requireActor("facility.manage");
  return run(
    () => dir.saveFacility(a, id, { ...formObject(fd, ["name", "type", "capacity", "location", "description", "managerId"]), isActive: id ? bool(fd, "isActive") : true }).then(() => "Facility saved."),
    ["/staff/admin/facilities"],
  );
}
