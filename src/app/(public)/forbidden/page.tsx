import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function Forbidden() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <ShieldAlert className="mx-auto h-12 w-12 text-red-600" />
      <h1 className="mt-4 text-2xl font-semibold">Access restricted</h1>
      <p className="mt-2 text-sm text-slate-600">Your role does not include permission for this page. If you believe this is an error, contact the system administrator.</p>
      <Link href="/staff" className="btn-primary mt-6">Return to my dashboard</Link>
    </div>
  );
}
