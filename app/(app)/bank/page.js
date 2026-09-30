"use client";
import TxPage from "@/components/TxPage";
import { BANK_CATEGORIES } from "@/lib/categories";
export default function Bank() {
  return <TxPage kind="bank" title="Bank transactions" categories={BANK_CATEGORIES} />;
}
