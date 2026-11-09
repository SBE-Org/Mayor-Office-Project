import Link from "next/link";
import { Lock, Paperclip } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { listCorrespondence } from "@/server/services/correspondence";
import { CORRESPONDENCE_STATUSES, label } from "@/shared/constants";
import { fmtDate } from "@/shared/format";
import { Badge, Card, Empty, PageHeader, Select, opts } from "@/components/ui";

export const metadata = { title: "Correspondence" };

export default async function CorrespondencePage({ searchParams }: { searchParams: Promise<{ q?: string; direction?: string; status?: string }> }) {
  const a = await requireActor(["correspondence.view", "correspondence.manage"]);
  const sp = await searchParams;
  const rows = await listCorrespondence(a, sp);
  return (
    <div>
      <PageHeader title="Official correspondence" subtitle="Incoming and outgoing letters with document numbers, approval and archive history" actions={can(a, "correspondence.manage") ? <Link href="/staff/correspondence/new" className="btn-primary">Register letter</Link> : null} />
      <Card>
        <form className="no-print mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Number, subject or organisation" className="input w-64" />
          <Select name="direction" defaultValue={sp.direction} placeholder="In & out" options={opts(["INCOMING", "OUTGOING"])} className="w-auto" />
          <Select name="status" defaultValue={sp.status} placeholder="Any status" options={opts(CORRESPONDENCE_STATUSES)} className="w-auto" />
          <button className="btn-navy">Search</button>
        </form>
        {!rows.length ? <Empty>No correspondence found.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Number</th><th>Subject</th><th>From → To</th><th>Letter date</th><th>Status</th><th>Case</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-mono text-xs"><Link href={`/staff/correspondence/${r.id}`} className="link">{r.documentNo}</Link></td>
                    <td>
                      <Link href={`/staff/correspondence/${r.id}`} className="font-medium hover:underline">{r.subject}</Link>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {label(r.direction)}
                        {r.confidentiality !== "NORMAL" && <Lock className="h-3 w-3 text-red-600" />}
                        {r._count.documents > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{r._count.documents}</span>}
                      </div>
                    </td>
                    <td className="text-xs">{r.senderOrg} → {r.recipientOrg}</td>
                    <td className="whitespace-nowrap text-xs">{fmtDate(r.letterDate)}</td>
                    <td><Badge value={r.status} /></td>
                    <td className="text-xs">{r.case ? <Link href={`/staff/cases/${r.case.id}`} className="link">{r.case.referenceNo}</Link> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
