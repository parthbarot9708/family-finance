"use client";
import TxPage from "@/components/TxPage";
import { getCfg } from "@/lib/settings";
export default function Bank() {
  return <TxPage kind="bank" title="Bank transactions" categories={getCfg().bankCats} />;
}
