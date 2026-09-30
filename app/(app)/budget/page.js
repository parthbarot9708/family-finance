"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabase";
import { getRate } from "@/lib/fx";
import { cad, inr } from "@/lib/format";
import { BANK_CATEGORIES } from "@/lib/categories";
import "@/components/tx.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const zeros = () => Array(12).fill(0);
const sum = (a) => a.reduce((s, n) => s + n, 0);

export default function Budget() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [mode, setMode] = useState("CAD");
  const [tx, setTx] = useState([]);
  const [latest, setLatest] = useState(0);

  useEffect(() => {
    (async () => {
      const a = `${year}-01-01`, b = `${year}-12-31`;
      const { data: t } = await supabase.from("transactions").select("tx_date,category,income,expense,fx_rate_inr,accounts!inner(kind)").eq("accounts.kind", "bank").gte("tx_date", a).lte("tx_date", b);
      setTx(t || []);
      setLatest((await getRate()) || 0);
    })();
  }, [year]);

  const w = (amt, fx) => (mode === "INR" ? Number(amt) * (fx ?? latest) : Number(amt));
  const fmt = mode === "INR" ? inr : cad;
  const inc = {}, exp = {};
  BANK_CATEGORIES.forEach((c) => { inc[c] = zeros(); exp[c] = zeros(); });
  tx.forEach((t) => {
    const m = Number(t.tx_date.slice(5, 7)) - 1;
    if (Number(t.income)) inc[t.category][m] += w(t.income, t.fx_rate_inr);
    if (Number(t.expense)) exp[t.category][m] += w(t.expense, t.fx_rate_inr);
  });

  const monthly = (g) => MONTHS.map((_, i) => sum(BANK_CATEGORIES.map((c) => g[c][i])));
  const mi = monthly(inc), me = monthly(exp);
  const tIn = sum(mi), tEx = sum(me);
  const chart = MONTHS.map((m, i) => ({ m, Income: Math.round(mi[i]), Expenses: Math.round(me[i]) }));

  const Grid = ({ title, g, tot }) => (
    <>
      <h2 style={{ margin: "1.75rem 0 .5rem" }}>{title}</h2>
      <div className="tbl-wrap" style={{ marginTop: 0 }}>
        <table className="tbl">
          <thead><tr><th>Item</th>{MONTHS.map((m) => <th key={m} className="num">{m}</th>)}<th className="num">Total</th><th className="num">Average</th></tr></thead>
          <tbody>
            {BANK_CATEGORIES.map((c) => (
              <tr key={c}>
                <td>{c}</td>
                {g[c].map((v, i) => <td key={i} className="num">{v ? fmt(v) : "–"}</td>)}
                <td className="num"><strong>{sum(g[c]) ? fmt(sum(g[c])) : "–"}</strong></td>
                <td className="num">{sum(g[c]) ? fmt(sum(g[c]) / 12) : "–"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td>{tot.map((v, i) => <td key={i} className="num">{fmt(v)}</td>)}<td className="num">{fmt(sum(tot))}</td><td className="num">{fmt(sum(tot) / 12)}</td></tr></tfoot>
        </table>
      </div>
    </>
  );

  return (
    <div style={{ maxWidth: "100%" }}>
      <h1>Annual budget</h1>
      <p className="sub">Built from your bank transactions (salary deposits are included as Salary income). Card spending shows up here as CC Bill payments.</p>
      <div style={{ display: "flex", gap: ".75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <select className="sel" style={{ width: 120 }} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {Array.from({ length: 6 }, (_, i) => thisYear + 1 - i).map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="sel" style={{ width: 160 }} value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Currency">
          <option value="CAD">Canadian dollars</option><option value="INR">Indian rupees</option>
        </select>
      </div>
      <div className="grid">
        <div className="card stat"><small>Total income</small><h2 className="pos">{fmt(tIn)}</h2></div>
        <div className="card stat"><small>Total expenses</small><h2 className="neg">{fmt(tEx)}</h2></div>
        <div className="card stat"><small>Current balance</small><h2 className={tIn - tEx < 0 ? "neg" : ""}>{fmt(tIn - tEx)}</h2></div>
        <div className="card stat"><small>Percentage of income spent</small><h2>{tIn ? Math.round((tEx / tIn) * 100) + "%" : "–"}</h2></div>
      </div>
      <div className="card" style={{ height: 300, marginTop: "1rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="m" stroke="var(--muted)" />
            <YAxis stroke="var(--muted)" width={70} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }} />
            <Legend />
            <Bar dataKey="Income" fill="var(--good)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill="var(--deep)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Grid title="Income" g={inc} tot={mi} />
      <Grid title="Expenses" g={exp} tot={me} />
    </div>
  );
}
