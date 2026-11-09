"use server";
import { bool, formObject, run, str, type ActionResult } from "@/server/action";
import { requireActor } from "@/server/auth/session";
import * as acc from "@/server/services/accounts";
import * as dir from "@/server/services/directory";

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

export async function togglePermissionAction(fd: FormData) {
  const a = await requireActor("role.manage");
  await acc.setRolePermission(a, str(fd, "role"), str(fd, "permission"), str(fd, "grant") === "1");
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/staff/admin/roles");
}

export async function saveDepartmentAction(id: string | null, _: A, fd: FormData) {
  const a = await requireActor("department.manage");
  return run(
    () => dir.saveDepartment(a, id, { ...formObject(fd, ["code", "name", "type", "subCityId", "headName", "phone", "email"]), isActive: id ? bool(fd, "isActive") : true }).then(() => "Department saved."),
    ["/staff/directory"],
  );
}
export async function saveSubCityAction(id: string | null, _: A, fd: FormData) {
  const a = await requireActor("department.manage");
  return run(() => dir.saveSubCity(a, id, { ...formObject(fd, ["code", "name"]), isActive: id ? bool(fd, "isActive") : true }).then(() => "Sub-city saved."), ["/staff/directory"]);
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
