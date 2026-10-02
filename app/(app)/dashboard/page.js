"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabase";
import { getRate } from "@/lib/fx";
import { cad, inr } from "@/lib/format";
import { getCfg, CURRENCIES } from "@/lib/settings";
import "@/components/tx.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SKIP = ["CC Bill", "Int. Transfers"]; // card bills are counted through card purchases; own-account moves aren't spending
const FIXED = ["Rent", "Loan", "Insurance", "Tax", "Education", "Phone", "GIC", "Rent / Mortgage", "Loan Payment", "EMI / Loan", "Taxes", "Health", "Medical", "SIP / Investments", "FD / RD", "Savings / Investments", "Mobile & Internet"];
const COLORS = ["#1E3A5F", "#B08D57", "#2F7D5B", "#9B4A4A", "#5B7C99", "#C9A96E", "#6B5B95", "#8A8F98"];
const sum = (a) => a.reduce((s, n) => s + n, 0);

export default function Dashboard() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(-1);
  const [mode, setMode] = useState("CAD");
  const [rows, setRows] = useState(null);
  const [latest, setLatest] = useState(0);
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    (async () => {
      const a = `${year}-01-01`, b = `${year}-12-31`;
      const { data: t } = await supabase.from("transactions").select("tx_date,category,income,expense,fx_rate_inr,accounts!inner(kind)").gte("tx_date", a).lte("tx_date", b);
      const r = [];
      (t || []).forEach((x) => {
        if (SKIP.includes(x.category)) return;
        const m = Number(x.tx_date.slice(5, 7)) - 1, fx = x.fx_rate_inr, card = x.accounts?.kind === "card";
        if (Number(x.expense)) r.push({ m, cat: x.category, type: "spend", amt: Number(x.expense), fx });
        if (Number(x.income)) {
          if (card) r.push({ m, cat: x.category, type: "spend", amt: -Number(x.income), fx }); // refunds reduce spending
          else r.push({ m, cat: x.category, type: "inc", amt: Number(x.income), fx });
        }
      });
      setRows(r);
      const { data: bd } = await supabase.from("budgets").select("category,monthly_limit");
      setBudgets(bd || []);
      setLatest((await getRate()) || 0);
    })();
  }, [year]);

  if (!rows) return null;
  const fmt = mode === "INR" ? inr : cad;
  const w = (r) => (mode === "INR" ? r.amt * (r.fx ?? latest) : r.amt);
  const incM = Array(12).fill(0), spM = Array(12).fill(0);
  rows.forEach((r) => (r.type === "inc" ? incM : spM)[r.m] += w(r));

  const sel = month < 0 ? rows : rows.filter((r) => r.m === month);
  const tInc = sum(sel.filter((r) => r.type === "inc").map(w));
  const tSp = sum(sel.filter((r) => r.type === "spend").map(w));
  const saved = tInc - tSp;
  const rate = tInc > 0 ? Math.round((saved / tInc) * 100) : null;

  const cats = {};
  sel.filter((r) => r.type === "spend").forEach((r) => (cats[r.cat] = (cats[r.cat] || 0) + w(r)));
  const catList = Object.entries(cats).map(([name, value]) => ({ name, value })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  const pie = catList.slice(0, 7).concat(catList.length > 7 ? [{ name: "Other", value: sum(catList.slice(7).map((c) => c.value)) }] : []);

  const activeMonths = spM.filter((v) => v > 0).length || 1;
  const avg = sum(spM) / activeMonths;
  const over = MONTHS.filter((_, i) => avg > 0 && spM[i] > avg * 1.15);
  const flex = catList.filter((c) => !FIXED.includes(c.name)).slice(0, 3);
  const per = month < 0 ? activeMonths : 1;

  const tips = [];
  if (flex[0]) {
    const s = (flex[0].value / per) * 0.1;
    tips.push(`${flex[0].name} is your largest flexible cost. Trimming it by 10% saves about ${fmt(s)} a month, or ${fmt(s * 12)} a year.`);
  }
  if (flex[1]) tips.push(`Next are ${flex.slice(1).map((c) => c.name).join(" and ")}. Setting a monthly limit for each is the simplest way to keep them steady.`);
  if (over.length) tips.push(`Spending ran more than 15% above your monthly average (${fmt(avg)}) in ${over.join(", ")}. Check those months for one-off purchases.`);
  if (rate !== null && rate < 20) tips.push(`You are keeping ${rate}% of income. To reach a 20% savings rate you would set aside another ${fmt(Math.max(0, tInc * 0.2 - saved))} in this period.`);
  if (rate !== null && rate >= 20) tips.push(`You are keeping ${rate}% of income, which is a strong savings rate. Moving the surplus into your monthly savings plan keeps it working toward your goals.`);

  const bm = month >= 0 ? month : year === thisYear ? new Date().getMonth() : 11;
  const spentBy = {};
  rows.filter((r) => r.type === "spend" && r.m === bm).forEach((r) => (spentBy[r.cat] = (spentBy[r.cat] || 0) + r.amt));
  const limits = budgets.map((b) => { const spent = spentBy[b.category] || 0, lim = Number(b.monthly_limit); return { cat: b.category, spent, lim, pct: lim > 0 ? (spent / lim) * 100 : 0 }; }).sort((x, y) => y.pct - x.pct);
  const warned = limits.filter((l) => l.pct >= 80);
  const tone = (p) => (p >= 100 ? "var(--bad)" : p >= 80 ? "var(--gold)" : "var(--good)");
  const limitsBlock = limits.length > 0 && (
    <div className="card" style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem" }}>
        <h3>Budget limits · {MONTHS[bm]} {year}</h3>
        <Link href="/limits" style={{ color: "var(--accent)" }}>Edit limits</Link>
      </div>
      {warned.length > 0 && <div className="msg err" style={{ marginTop: ".75rem" }}>{warned.length} {warned.length > 1 ? "categories are" : "category is"} at 80% or more of the limit.</div>}
      {limits.map((l) => (
        <div key={l.cat} style={{ marginTop: ".7rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem" }}><span>{l.cat}</span><span style={{ color: l.pct >= 80 ? tone(l.pct) : "var(--muted)" }}>{cad(l.spent)} of {cad(l.lim)} · {Math.round(l.pct)}%</span></div>
          <div style={{ height: 8, background: "var(--line)", borderRadius: 8 }}><div style={{ width: `${Math.min(100, l.pct)}%`, height: 8, borderRadius: 8, background: tone(l.pct) }} /></div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <h1>Dashboard</h1>
      <p className="sub">Income and spending from your bank accounts and cards. Card bill payments are skipped so nothing is counted twice.</p>
      <div style={{ display: "flex", gap: ".75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <select className="sel" style={{ width: 110 }} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {Array.from({ length: 6 }, (_, i) => thisYear + 1 - i).map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="sel" style={{ width: 140 }} value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Month">
          <option value={-1}>Whole year</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select className="sel" style={{ width: 170 }} value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Currency">
          <option value="CAD">{CURRENCIES[getCfg().base]?.name || getCfg().base}</option><option value="INR">{CURRENCIES[getCfg().second]?.name || getCfg().second}</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <h3>No data for {year} yet</h3>
          <p className="sub">Add transactions and your charts will appear here.</p>
          <Link className="btn" href="/bank">Add a transaction</Link>
        </div>
      ) : (
        <>
          <div className="grid">
            <div className="card stat"><small>Income</small><h2 className="pos">{fmt(tInc)}</h2></div>
            <div className="card stat"><small>Spending</small><h2 className="neg">{fmt(tSp)}</h2></div>
            <div className="card stat"><small>Left over</small><h2 className={saved < 0 ? "neg" : ""}>{fmt(saved)}</h2><small>{rate !== null ? `${rate}% of income kept` : ""}</small></div>
            <div className="card stat"><small>Average monthly spending</small><h2>{fmt(avg)}</h2><small>{activeMonths} month{activeMonths > 1 ? "s" : ""} with spending</small></div>
          </div>

          {limitsBlock}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", marginTop: "1rem" }}>
            <div className="card" style={{ height: 340 }}>
              <h3 style={{ marginBottom: ".5rem" }}>Monthly cost trend</h3>
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={MONTHS.map((m, i) => ({ m, Income: Math.round(incM[i]), Spending: Math.round(spM[i]) }))}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="m" stroke="var(--muted)" />
                  <YAxis stroke="var(--muted)" width={70} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }} />
                  <Legend />
                  <Line type="monotone" dataKey="Income" stroke="var(--good)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Spending" stroke="var(--deep)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ height: 340 }}>
              <h3 style={{ marginBottom: ".5rem" }}>Spending by category</h3>
              {pie.length === 0 ? <p className="sub">No spending in this period.</p> : (
                <ResponsiveContainer width="100%" height="88%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={105} paddingAngle={2} stroke="var(--surface)">
                      {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", marginTop: "1rem" }}>
            <div className="card">
              <h3 style={{ marginBottom: ".75rem" }}>Where the money goes</h3>
              {catList.slice(0, 8).map((c) => (
                <div key={c.name} style={{ marginBottom: ".6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem" }}><span>{c.name}</span><span>{fmt(c.value)}</span></div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 6 }}><div style={{ width: `${(c.value / catList[0].value) * 100}%`, height: 6, background: "var(--gold)", borderRadius: 6 }} /></div>
                </div>
              ))}
            </div>
            <div className="card">
              <h3 style={{ marginBottom: ".75rem" }}>Where you can save</h3>
              {tips.length === 0 ? <p className="sub">Add more spending and income to see tailored tips.</p> : (
                <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: ".6rem" }}>{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
