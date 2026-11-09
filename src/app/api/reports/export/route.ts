import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { getActor } from "@/server/auth/session";
import { can, caseWhere } from "@/server/access";
import { prisma } from "@/server/db";
import { buildReport, parseRange } from "@/server/services/reports";
import { audit } from "@/server/audit";
import { ymd } from "@/shared/format";

export async function GET(req: NextRequest) {
  const a = await getActor();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(a, "report.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const range = parseRange({ from: req.nextUrl.searchParams.get("from") ?? undefined, to: req.nextUrl.searchParams.get("to") ?? undefined });
  const r = await buildReport(a, range);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Shaggar City Mayor's Office DMS";
  const header = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF172C4F" } };
  };

  const sum = wb.addWorksheet("Summary");
  sum.columns = [{ header: "Measure", key: "k", width: 40 }, { header: "Value", key: "v", width: 20 }];
  header(sum);
  sum.addRows([
    { k: "Period from", v: ymd(range.from) },
    { k: "Period to", v: ymd(range.to) },
    { k: "Cases received", v: r.totals.cases },
    { k: "Open", v: r.totals.open },
    { k: "Closed", v: r.totals.closed },
    { k: "Overdue", v: r.totals.overdue },
    { k: "Average resolution (days)", v: r.totals.avgResolutionDays ?? "" },
    { k: "Appointments", v: r.appointments.total },
    { k: "Approved reservations", v: r.reservations.total },
    { k: "Satisfaction average (1-5)", v: r.satisfaction.average ?? "" },
    { k: "Satisfaction responses", v: r.satisfaction.responses },
  ]);

  const breakdown = wb.addWorksheet("Breakdowns");
  breakdown.columns = [{ header: "Dimension", key: "d", width: 18 }, { header: "Value", key: "n", width: 45 }, { header: "Cases", key: "c", width: 10 }];
  header(breakdown);
  for (const [d, rows] of [["Status", r.byStatus], ["Category", r.byCategory], ["Department", r.byDepartment], ["Sub-city", r.bySubCity], ["Priority", r.byPriority]] as const) {
    for (const x of rows) breakdown.addRow({ d, n: x.name, c: x.count });
  }

  const dp = wb.addWorksheet("Department performance");
  dp.columns = [
    { header: "Department", key: "name", width: 40 }, { header: "Assigned", key: "assigned" }, { header: "Completed", key: "completed" },
    { header: "Rate %", key: "rate" }, { header: "Overdue", key: "overdue" }, { header: "Avg days", key: "avgDays" },
  ];
  header(dp);
  dp.addRows(r.departments);

  const scope = can(a, "case.view.all") || can(a, "dashboard.admin") ? {} : caseWhere(a);
  const cases = await prisma.case.findMany({
    where: { AND: [scope, { createdAt: { gte: range.from, lte: range.to } }, can(a, "case.view.confidential") ? {} : { confidentiality: "NORMAL" }] },
    include: { category: true, department: true, subCity: true },
    orderBy: { createdAt: "asc" },
  });
  const cl = wb.addWorksheet("Case register");
  cl.columns = [
    { header: "Reference", key: "ref", width: 18 }, { header: "Received", key: "rec", width: 12 }, { header: "Type", key: "type", width: 12 },
    { header: "Category", key: "cat", width: 28 }, { header: "Priority", key: "pri" }, { header: "Status", key: "st", width: 18 },
    { header: "Department", key: "dep", width: 32 }, { header: "Sub-city", key: "sc", width: 18 }, { header: "Deadline", key: "dl", width: 12 }, { header: "Closed", key: "cl", width: 12 },
  ];
  header(cl);
  // Citizen names and case content are intentionally excluded from exports.
  for (const c of cases) {
    cl.addRow({ ref: c.referenceNo, rec: ymd(c.createdAt), type: c.type, cat: c.category.name, pri: c.priority, st: c.status, dep: c.department?.name ?? "", sc: c.subCity?.name ?? "", dl: c.deadline ? ymd(c.deadline) : "", cl: c.closedAt ? ymd(c.closedAt) : "" });
  }

  const buf = await wb.xlsx.writeBuffer();
  await audit(prisma, a.id, "REPORT_EXPORT", "Report", null, { from: ymd(range.from), to: ymd(range.to) });
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="smo-report-${ymd(range.from)}-to-${ymd(range.to)}.xlsx"`,
    },
  });
}
