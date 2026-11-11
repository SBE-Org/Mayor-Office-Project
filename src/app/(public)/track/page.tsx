import { getDict } from "@/server/i18n";
import { TrackForm } from "./TrackForm";

export const metadata = { title: "Track" };

export default async function TrackPage() {
  const { t } = await getDict();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{t.track}</h1>
      <p className="mt-1 text-sm text-slate-600">{t.trackText}</p>
      <div className="mt-6"><TrackForm labels={{ referenceNo: t.referenceNo, phone: t.phone, search: t.search, notFound: t.notFound, or: t.or, required: t.trackRequired, choose: t.trackChoose, view: t.view }} /></div>
    </div>
  );
}
