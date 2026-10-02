"use client";
import TxPage from "@/components/TxPage";
import { getCfg } from "@/lib/settings";
export default function Cards() {
  return <TxPage kind="card" title="Card transactions" categories={getCfg().cardCats} />;
}
