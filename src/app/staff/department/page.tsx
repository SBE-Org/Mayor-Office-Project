import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { caseWhere } from "@/server/access";
import { Card, PageHeader, Stat } from "@/components/ui";
import { CaseTable } from "@/components/CaseTable";

export const metadata = { title: "Department dashboard" };

export default async function DepartmentDashboard() {
  const a = await requireActor("dashboard.department");
  const dept = a.departmentId ? await prisma.department.findUnique({ where: { id: a.departmentId } }) : null;
  const scope = caseWhere(a);
  const now = new Date();
  const count = (extra: object) => prisma.case.count({ where: { AND: [scope, extra] } });
  const [newly, inProgress, overdue, responded, closed] = await Promise.all([
    count({ status: "ASSIGNED" }),
    count({ status: "IN_PROGRESS" }),
    count({ deadline: { lt: now }, status: { in: ["ASSIGNED", "IN_PROGRESS"] } }),
    count({ status: "RESPONDED" }),
    count({ status: "CLOSED" }),
  ]);
  const open = await prisma.case.findMany({
    where: { AND: [scope, { status: { in: ["ASSIGNED", "IN_PROGRESS"] } }] },
    include: { citizen: true, category: true, department: true, executive: true },
    orderBy: [{ deadline: "asc" }],
  });
  return (
    <div className="space-y-6">
      <PageHeader title={dept?.name ?? "Department"} subtitle={`${a.fullName} · ${a.roleName}`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="New assignments" value={newly} tone={newly ? "warn" : "default"} />
        <Stat label="In progress" value={inProgress} />
        <Stat label="Overdue" value={overdue} tone={overdue ? "danger" : "default"} />
        <Stat label="Reported complete" value={responded} />
        <Stat label="Closed" value={closed} tone="good" />
      </div>
      <Card title="Open cases (earliest deadline first)" actions={<Link href="/staff/cases" className="link text-xs">All department cases</Link>}>
        <CaseTable rows={open} />
      </Card>
    </div>
  );
}
