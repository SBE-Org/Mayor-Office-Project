import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge, Empty } from "./ui";
import { fmtDate } from "@/shared/format";

type Row = {
  id: string;
  referenceNo: string;
  title: string;
  status: string;
  priority: string;
  confidentiality: string;
  createdAt: Date;
  deadline: Date | null;
  citizen: { fullName: string };
  category: { name: string };
  department?: { name: string } | null;
  executive?: { fullName: string } | null;
};

export function CaseTable({ rows, base = "/staff/cases", showCitizen = true }: { rows: Row[]; base?: string; showCitizen?: boolean }) {
  if (!rows.length) return <Empty>No cases found.</Empty>;
  const now = new Date();
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Subject</th>
            {showCitizen && <th>Citizen</th>}
            <th>Status</th>
            <th>Priority</th>
            <th>With</th>
            <th>Deadline</th>
            <th>Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((c) => {
            const overdue = c.deadline && c.deadline < now && !["CLOSED", "RESPONDED"].includes(c.status);
            return (
              <tr key={c.id}>
                <td className="whitespace-nowrap font-mono text-xs">
                  <Link href={`${base}/${c.id}`} className="link">{c.referenceNo}</Link>
                </td>
                <td className="max-w-xs">
                  <Link href={`${base}/${c.id}`} className="font-medium text-slate-800 hover:underline">{c.title}</Link>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    {c.confidentiality !== "NORMAL" && <Lock className="h-3 w-3 text-red-600" aria-label="Confidential" />}
                    {c.category.name}
                  </div>
                </td>
                {showCitizen && <td className="whitespace-nowrap">{c.citizen.fullName}</td>}
                <td><Badge value={c.status} /></td>
                <td><Badge value={c.priority} kind="priority" /></td>
                <td className="text-xs text-slate-600">{c.status === "AWAITING_EXECUTIVE" ? c.executive?.fullName : c.department?.name ?? "Mayor's Office"}</td>
                <td className={`whitespace-nowrap text-xs ${overdue ? "font-semibold text-red-700" : "text-slate-600"}`}>{c.deadline ? fmtDate(c.deadline) : "—"}{overdue ? " · overdue" : ""}</td>
                <td className="whitespace-nowrap text-xs text-slate-600">{fmtDate(c.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
