"use client";
import TxPage from "@/components/TxPage";
import { CARD_CATEGORIES } from "@/lib/categories";
export default function Cards() {
  return <TxPage kind="card" title="Card transactions" categories={CARD_CATEGORIES} />;
}
