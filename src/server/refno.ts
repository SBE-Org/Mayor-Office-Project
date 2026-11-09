import type { Tx } from "@/server/db";

export async function nextNumber(tx: Tx, key: string): Promise<number> {
  const c = await tx.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  return c.value;
}
const year = () => new Date().getFullYear();
export async function caseRef(tx: Tx) {
  return `SMO-${year()}-${String(await nextNumber(tx, `case-${year()}`)).padStart(6, "0")}`;
}
export async function appointmentRef(tx: Tx) {
  return `APT-${year()}-${String(await nextNumber(tx, `apt-${year()}`)).padStart(5, "0")}`;
}
export async function reservationRef(tx: Tx) {
  return `RSV-${year()}-${String(await nextNumber(tx, `rsv-${year()}`)).padStart(5, "0")}`;
}
export async function correspondenceRef(tx: Tx, direction: "INCOMING" | "OUTGOING") {
  const p = direction === "INCOMING" ? "IN" : "OUT";
  return `${p}/${year()}/${String(await nextNumber(tx, `${p}-${year()}`)).padStart(4, "0")}`;
}
