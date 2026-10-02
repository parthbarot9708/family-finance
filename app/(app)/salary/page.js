"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getRate } from "@/lib/fx";
import { cad, inr } from "@/lib/format";
import { getCfg } from "@/lib/settings";
import { FilterBar, applyFilters, emptyFilters, isFiltered } from "@/components/Filters";
import "@/components/tx.css";

export default function Salary() {
  const [rows, setRows] = useState(null);
  const [latest, setLatest] = useState(0);
  const [flt, setFlt] = useState(emptyFilters);

  async function load() {
    const { data: b } = await supabase.from("transactions").select("id,tx_date,description,notes,income,fx_rate_inr,accounts!inner(kind,institution,name)").eq("category", "Salary").eq("accounts.kind", "bank").gt("income", 0);
    const { data: m } = await supabase.from("salary").select("*");
    const fromBank = (b || []).map((x) => ({ id: x.id, src: "bank", tx_date: x.tx_date, category: "Salary", description: x.description, notes: x.notes, income: Number(x.income), expense: 0, fx: x.fx_rate_inr, account: `${x.accounts.institution} – ${x.accounts.name}` }));
    const manual = (m || []).map((x) => ({ id: x.id, src: "manual", tx_date: x.pay_date, category: "Salary", description: [x.employer, x.description].filter(Boolean).join(" – "), notes: "Older manual entry", income: Number(x.amount), expense: 0, fx: x.fx_rate_inr, account: "Salary tab (older)" }));
    setRows([...fromBank, ...manual].sort((p, q) => p.tx_date.localeCompare(q.tx_date)));
    setLatest((await getRate()) || 0);
  }
  useEffect(() => { load(); }, []);

  async function delManual(id) {
    if (!confirm("Delete this older manual entry?")) return;
    await supabase.from("salary").delete().eq("id", id);
    load();
  }
  if (!rows) return null;

  let run = 0;
  const all = rows.map((r) => { run += r.income; return { ...r, rate: r.fx ?? latest, run }; });
  const list = applyFilters(all, flt).reverse();
  const total = list.reduce((s, r) => s + r.income, 0);
  const totalInr = list.reduce((s, r) => s + r.income * r.rate, 0);
  const tag = isFiltered(flt) ? " (filtered)" : "";

  return (
    <>
      <h1>Salary</h1>
      <p className="sub">A reference view built automatically from bank transactions with the category <strong>Salary</strong>. To add or change a pay deposit, use <Link href="/bank" style={{ color: "var(--accent)" }}>Bank transactions</Link>.</p>
      <div className="grid">
        <div className="card stat"><small>Total salary{tag}</small><h2 className="pos">{cad(total)}</h2><small>{inr(totalInr)}</small></div>
        <div className="card stat"><small>Deposits{tag}</small><h2>{list.length}</h2></div>
        <div className="card stat"><small>Average deposit{tag}</small><h2>{cad(list.length ? total / list.length : 0)}</h2></div>
      </div>

      <FilterBar f={flt} setF={setFlt} rows={all} showCategory={false} showType={false} />
      <div className="barrow"><span>Showing {list.length} of {all.length} deposits</span></div>

      <div className="tbl-wrap">
        <table className="tbl hm">
          <thead><tr><th>Date</th><th className="hide-m">Account</th><th>Description</th><th className="hide-m">Notes</th><th className="num">Amount</th><th className="num hide-m">Rate</th><th className="num">{getCfg().second}</th><th className="num hide-m">Running total</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={9} style={{ color: "var(--muted)" }}>{all.length ? "No deposits match these filters." : "No salary yet. Add a bank transaction with the category Salary and it appears here."}</td></tr>}
            {list.map((r) => (
              <tr key={r.src + r.id}>
                <td className="dt">{r.tx_date}</td><td className="nw hide-m">{r.account}</td><td className="txt">{r.description}</td><td className="txt hide-m">{r.notes}</td>
                <td className="num">{cad(r.income)}</td>
                <td className="num hide-m">{r.fx ? Number(r.fx).toFixed(2) : "–"}</td>
                <td className="num">{inr(r.income * r.rate)}</td>
                <td className="num hide-m">{cad(r.run)}</td>
                <td className="nw">{r.src === "manual" && <button className="x" title="Delete older manual entry" aria-label="Delete" onClick={() => delManual(r.id)}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4}>Total{tag}</td><td className="num">{cad(total)}</td><td></td><td className="num">{inr(totalInr)}</td><td></td><td></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}
