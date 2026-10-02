"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cad } from "@/lib/format";
import "./tx.css";

function balAt(start, endYM, monthly, annual, startAmt) {
  const [sy, sm] = start.split("-").map(Number), [ey, em] = endYM.split("-").map(Number);
  const n = (ey - sy) * 12 + (em - sm) + 1;
  let bal = startAmt;
  for (let i = 0; i < n; i++) bal += (bal * annual) / 1200 + monthly;
  return bal;
}
function needed(start, endYM, target, annual, startAmt) {
  let lo = 0, hi = Math.max(target, 1);
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; balAt(start, endYM, mid, annual, startAmt) >= target ? (hi = mid) : (lo = mid); }
  return hi;
}

export default function Goals({ start, monthly, annual, startAmt }) {
  const [goals, setGoals] = useState([]);
  const [f, setF] = useState({ name: "", target: "", date: "2028-12-31" });
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = async () => { const { data } = await supabase.from("goals").select("*").order("target_date"); setGoals(data || []); };
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault(); setError("");
    const { error } = await supabase.from("goals").insert({ name: f.name, target_amount: Number(f.target), target_date: f.date });
    if (error) setError(error.message); else { setF({ ...f, name: "", target: "" }); load(); }
  }
  async function del(id) {
    if (!confirm("Delete this goal?")) return;
    await supabase.from("goals").delete().eq("id", id); load();
  }

  return (
    <>
      <h2 style={{ margin: "1.5rem 0 .5rem" }}>Savings goals</h2>
      <p className="sub" style={{ marginBottom: ".75rem" }}>Each goal is checked against the plan above.</p>
      <form className="card" onSubmit={add}>
        {error && <div className="msg err">{error}</div>}
        <div className="form-row">
          <label>Goal name<input required value={f.name} onChange={set("name")} placeholder="e.g. Remitly fund" /></label>
          <label>Target amount<input type="number" min="1" step="1" required value={f.target} onChange={set("target")} /></label>
          <label>Target date<input type="date" required value={f.date} onChange={set("date")} /></label>
          <button className="btn">Add goal</button>
        </div>
      </form>
      <div className="grid" style={{ marginTop: "1rem" }}>
        {goals.map((g) => {
          const ym = g.target_date.slice(0, 7), target = Number(g.target_amount);
          const past = ym < start;
          const proj = past ? startAmt : balAt(start, ym, monthly, annual, startAmt);
          const pct = Math.min(100, (proj / target) * 100), ok = proj >= target;
          return (
            <div className="card stat" key={g.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><strong>{g.name}</strong><button className="x" aria-label="Delete goal" onClick={() => del(g.id)}>✕</button></div>
              <small>Target {cad(target)} by {g.target_date}</small>
              <h2 className={ok ? "pos" : ""}>{Math.round(pct)}%</h2>
              <div style={{ height: 8, background: "var(--line)", borderRadius: 8, margin: ".4rem 0" }}><div style={{ width: `${pct}%`, height: 8, borderRadius: 8, background: ok ? "var(--good)" : "var(--gold)" }} /></div>
              <small>{past ? "This date is before your plan starts." : `Plan reaches ${cad(proj)} by then. ${ok ? "You are on track." : `Short by ${cad(target - proj)}. Saving about ${cad(needed(start, ym, target, annual, startAmt))} a month would get there.`}`}</small>
            </div>
          );
        })}
      </div>
    </>
  );
}
