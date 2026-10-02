"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabase";
import { cad } from "@/lib/format";
import "@/components/tx.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COLORS = ["#1E3A5F", "#B08D57", "#2F7D5B", "#9B4A4A", "#5B7C99", "#C9A96E", "#6B5B95", "#8A8F98"];
const tip = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 };
const sum = (a) => a.reduce((s, n) => s + n, 0);

export default function Household() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [code, setCode] = useState(null);
  const [members, setMembers] = useState([]);
  const [rows, setRows] = useState([]);
  const [join, setJoin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setName((n) => n || user?.user_metadata?.name || "");
    const { data: h } = await supabase.from("households").select("invite_code").limit(1);
    setCode(h?.[0]?.invite_code || "");
    if (!h?.length) return;
    const { data: m } = await supabase.from("household_members").select("user_id,display_name");
    setMembers(m || []);
    const { data } = await supabase.rpc("household_monthly", { p_year: year });
    setRows(data || []);
  }
  useEffect(() => { load(); }, [year]);

  async function create() { setError(""); const { error } = await supabase.rpc("create_household", { p_name: name || "Me" }); error ? setError(error.message) : load(); }
  async function joinIt() { setError(""); const { error } = await supabase.rpc("join_household", { p_code: join.trim(), p_name: name || "Me" }); error ? setError(error.message) : load(); }
  if (code === null) return null;

  if (!code)
    return (
      <>
        <h1>Household</h1>
        <p className="sub">Combine your totals with a partner. Only monthly totals by category are shared, never individual entries.</p>
        {error && <div className="msg err">{error}</div>}
        <div className="grid">
          <div className="card"><h3>Start a household</h3><p className="sub">Create it, then share the invite code.</p>
            <label className="field">Your display name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <button className="btn" onClick={create}>Create household</button></div>
          <div className="card"><h3>Join with a code</h3><p className="sub">Enter the code your partner shared.</p>
            <label className="field">Invite code<input value={join} onChange={(e) => setJoin(e.target.value)} /></label>
            <button className="btn" onClick={joinIt}>Join household</button></div>
        </div>
      </>
    );

  const currencies = [...new Set(rows.map((r) => r.currency))];
  const mixed = currencies.length > 1;
  const incM = Array(12).fill(0), spM = Array(12).fill(0), by = {}, cats = {};
  members.forEach((m) => (by[m.display_name] = { inc: 0, sp: 0, months: Array(12).fill(0) }));
  rows.forEach((r) => {
    const i = r.month - 1, e = Number(r.expense), n = Number(r.income);
    incM[i] += n; spM[i] += e;
    const b = by[r.display_name]; if (b) { b.inc += n; b.sp += e; b.months[i] += e; }
    cats[r.category] = (cats[r.category] || 0) + e;
  });
  const names = Object.keys(by);
  const tInc = sum(incM), tSp = sum(spM);
  const catList = Object.entries(cats).map(([n, v]) => ({ name: n, value: v })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  const pie = catList.slice(0, 7).concat(catList.length > 7 ? [{ name: "Other", value: sum(catList.slice(7).map((c) => c.value)) }] : []);
  const pct = (a, b) => (a > 0 ? Math.round(((a - b) / a) * 100) + "%" : "–");

  return (
    <>
      <h1>Household</h1>
      <p className="sub">Combined view. Only monthly totals by category are shared; descriptions, notes and accounts stay private.</p>
      <div className="card" style={{ marginBottom: "1rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <span>Invite code: <strong>{code}</strong></span>
        <select className="sel" style={{ width: 110 }} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {Array.from({ length: 6 }, (_, i) => thisYear + 1 - i).map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>
      {mixed && <div className="msg err">Members of this household use different currencies ({currencies.join(", ")}), so combined totals would be misleading. Use one household per currency.</div>}
      {!mixed && (
        <>
          <div className="grid">
            <div className="card stat"><small>Combined income</small><h2 className="pos">{cad(tInc)}</h2></div>
            <div className="card stat"><small>Combined spending</small><h2 className="neg">{cad(tSp)}</h2></div>
            <div className="card stat"><small>Left over</small><h2 className={tInc - tSp < 0 ? "neg" : ""}>{cad(tInc - tSp)}</h2><small>{pct(tInc, tSp)} of income kept</small></div>
          </div>
          <div className="grid" style={{ marginTop: "1rem" }}>
            {names.map((n) => (
              <div className="card stat" key={n}><strong>{n}</strong>
                <p style={{ margin: ".4rem 0 0", fontSize: ".92rem" }}><span className="pos">Income {cad(by[n].inc)}</span><br /><span className="neg">Spending {cad(by[n].sp)}</span><br /><small>{pct(by[n].inc, by[n].sp)} of income kept</small></p>
              </div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", marginTop: "1rem" }}>
            <div className="card" style={{ height: 320 }}>
              <h3 style={{ marginBottom: ".5rem" }}>Combined income and spending</h3>
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={MONTHS.map((m, i) => ({ m, Income: Math.round(incM[i]), Spending: Math.round(spM[i]) }))}>
                  <CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="m" stroke="var(--muted)" /><YAxis stroke="var(--muted)" width={70} />
                  <Tooltip formatter={(v) => cad(v)} contentStyle={tip} /><Legend />
                  <Line type="monotone" dataKey="Income" stroke="var(--good)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Spending" stroke="var(--deep)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ height: 320 }}>
              <h3 style={{ marginBottom: ".5rem" }}>Spending by person</h3>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={MONTHS.map((m, i) => ({ m, ...Object.fromEntries(names.map((n) => [n, Math.round(by[n].months[i])])) }))}>
                  <CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="m" stroke="var(--muted)" /><YAxis stroke="var(--muted)" width={70} />
                  <Tooltip formatter={(v) => cad(v)} contentStyle={tip} /><Legend />
                  {names.map((n, i) => <Bar key={n} dataKey={n} stackId="a" fill={COLORS[i % COLORS.length]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ height: 320 }}>
              <h3 style={{ marginBottom: ".5rem" }}>Household spending by category</h3>
              {pie.length === 0 ? <p className="sub">No spending yet this year.</p> : (
                <ResponsiveContainer width="100%" height="88%">
                  <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={105} paddingAngle={2} stroke="var(--surface)">{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
                    <Tooltip formatter={(v) => cad(v)} contentStyle={tip} /><Legend /></PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="card">
              <h3 style={{ marginBottom: ".75rem" }}>Top categories</h3>
              {catList.slice(0, 8).map((c) => (
                <div key={c.name} style={{ marginBottom: ".6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem" }}><span>{c.name}</span><span>{cad(c.value)}</span></div>
                  <div style={{ height: 6, background: "var(--line)", borderRadius: 6 }}><div style={{ width: `${(c.value / catList[0].value) * 100}%`, height: 6, background: "var(--gold)", borderRadius: 6 }} /></div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
