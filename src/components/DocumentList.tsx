import { FileText } from "lucide-react";
import { Empty } from "./ui";
import { fmtDateTime } from "@/shared/format";

export function DocumentList({ docs }: { docs: { id: string; fileName: string; size: number; createdAt: Date }[] }) {
  if (!docs.length) return <Empty>No documents attached.</Empty>;
  return (
    <ul className="divide-y divide-slate-100">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <a href={`/api/files/${d.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 text-brand-700 hover:underline">
            <FileText className="h-4 w-4 shrink-0" /> <span className="truncate">{d.fileName}</span>
          </a>
          <span className="shrink-0 text-xs text-slate-500">{(d.size / 1024).toFixed(0)} KB · {fmtDateTime(d.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
