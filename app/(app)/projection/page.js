"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabase";
import { getRate } from "@/lib/fx";
import { cad, inr } from "@/lib/format";
import "@/components/tx.css";

function project(start, end, monthly, rate, annual, startAmt) {
  const [sy, sm] = start.split("-").map(Number), [ey, em] = end.split("-").map(Number);
  const n = (ey - sy) * 12 + (em - sm) + 1;
  const out = [];
  let bal = startAmt;
  for (let i = 0; i < n; i++) {
    const d = new Date(sy, sm - 1 + i, 1);
    const interest = (bal * annual) / 100 / 12;
    bal += interest + monthly;
    out.push({ label: d.toLocaleString("en-CA", { month: "short", year: "numeric" }), deposit: monthly, interest, bal, sent: monthly * rate, inrBal: bal * rate });
  }
  return out;
}

export default function Projection() {
  const [ready, setReady] = useState(false);
  const [s, setS] = useState({ monthly: 500, rate: 60, annual: 0, startAmt: 0, start: new Date().toISOString().slice(0, 7), end: "2028-12" });
  const [market, setMarket] = useState(null);
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setS({ ...s, [k]: k === "start" || k === "end" ? e.target.value : e.target.value === "" ? "" : Number(e.target.value) });

  useEffect(() => {
    (async () => {
      const m = await getRate();
      setMarket(m);
      const { data } = await supabase.from("projection_settings").select("*").maybeSingle();
      if (data) setS({ monthly: Number(data.monthly_saving), rate: Number(data.remitly_rate), annual: Number(data.annual_return || 0), startAmt: Number(data.starting_amount || 0), start: data.start_month.slice(0, 7), end: data.end_month.slice(0, 7) });
      else if (m) setS((x) => ({ ...x, rate: Math.round(m * 100) / 100 }));
      setReady(true);
    })();
  }, []);

  async function save() {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("projection_settings").upsert({
      user_id: user.id, monthly_saving: s.monthly || 0, remitly_rate: s.rate || 0, annual_return: s.annual || 0,
      starting_amount: s.startAmt || 0, start_month: s.start + "-01", end_month: s.end + "-01",
    });
    setMsg(error ? error.message : "Saved.");
    setTimeout(() => setMsg(""), 2500);
  }

  if (!ready) return null;
  const args = [s.start, s.end];
  const rows = project(...args, s.monthly || 0, s.rate || 0, s.annual || 0, s.startAmt || 0);
  const last = rows[rows.length - 1];
  const deposited = (s.startAmt || 0) + (s.monthly || 0) * rows.length;
  const tip = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10 };
  const scen = [s.monthly || 0, (s.monthly || 0) + 100, (s.monthly || 0) + 250].map((m) => {
    const r = project(...args, m, s.rate || 0, s.annual || 0, s.startAmt || 0);
    return { m, end: r[r.length - 1] };
  });

  return (
    <>
      <h1>Future projection</h1>
      <p className="sub">Plan what you will save each month and send to India through Remitly, through {s.end ? new Date(s.end + "-01T00:00").toLocaleString("en-CA", { month: "long", year: "numeric" }) : "your end date"}.</p>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="form-row">
          <label>Monthly saving (CAD)<input type="number" min="0" step="10" value={s.monthly} onChange={set("monthly")} /></label>
          <label>Remitly rate (INR per CAD)<input type="number" min="0" step="0.01" value={s.rate} onChange={set("rate")} /></label>
          <label>Yearly interest % (optional)<input type="number" min="0" step="0.1" value={s.annual} onChange={set("annual")} /></label>
          <label>Already saved (CAD)<input type="number" min="0" step="10" value={s.startAmt} onChange={set("startAmt")} /></label>
          <label>First month<input type="month" value={s.start} onChange={set("start")} /></label>
          <label>Last month<input type="month" value={s.end} onChange={set("end")} /></label>
          <button className="btn" onClick={save}>Save plan</button>
        </div>
        <p className="sub" style={{ margin: ".75rem 0 0", fontSize: ".85rem" }}>
          {msg || `Remitly's rate is usually a little below the market rate${market ? ` (today's market rate is ₹${market.toFixed(2)})` : ""}. Enter the rate you actually get.`}
        </p>
      </div>

      {rows.length === 0 ? <div className="msg err">The last month must be after the first month.</div> : (
        <>
          <div className="grid">
            <div className="card stat"><small>Saved by {last.label}</small><h2 className="pos">{cad(last.bal)}</h2><small>{inr(last.inrBal)}</small></div>
            <div className="card stat"><small>You put in</small><h2>{cad(deposited)}</h2><small>{rows.length} monthly transfers</small></div>
            <div className="card stat"><small>Interest earned</small><h2>{cad(last.bal - deposited)}</h2></div>
            <div className="card stat"><small>Sent to India each month</small><h2>{inr(last.sent)}</h2></div>
          </div>

          <div className="card" style={{ height: 340, marginTop: "1rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows.map((r) => ({ m: r.label, CAD: Math.round(r.bal), INR: Math.round(r.inrBal) }))}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--muted)" interval="preserveStartEnd" minTickGap={30} />
                <YAxis yAxisId="l" stroke="var(--muted)" width={70} />
                <YAxis yAxisId="r" orientation="right" stroke="var(--muted)" width={80} />
                <Tooltip contentStyle={tip} />
                <Legend />
                <Line yAxisId="l" dataKey="CAD" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                <Line yAxisId="r" dataKey="INR" stroke="var(--gold)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h2 style={{ margin: "1.5rem 0 .5rem" }}>What if you saved more?</h2>
          <div className="grid">
            {scen.map((x, i) => (
              <div className="card stat" key={i}><small>{cad(x.m)} a month{i === 0 ? " (your plan)" : ""}</small><h2>{cad(x.end.bal)}</h2><small>{inr(x.end.inrBal)} by {x.end.label}</small></div>
            ))}
          </div>

          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Month</th><th className="num">Deposit</th><th className="num">Interest</th><th className="num">Balance (CAD)</th><th className="num">Sent via Remitly</th><th className="num">Balance (INR)</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.label}><td>{r.label}</td><td className="num">{cad(r.deposit)}</td><td className="num">{cad(r.interest)}</td><td className="num">{cad(r.bal)}</td><td className="num">{inr(r.sent)}</td><td className="num">{inr(r.inrBal)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
