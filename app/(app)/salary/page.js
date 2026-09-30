"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getRate } from "@/lib/fx";
import { cad, inr } from "@/lib/format";
import "@/components/tx.css";

export default function Salary() {
  const today = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState(null);
  const [latest, setLatest] = useState(0);
  const [f, setF] = useState({ date: today, employer: "", description: "Salary", amount: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function load() {
    const { data } = await supabase.from("salary").select("*").order("pay_date").order("created_at");
    setRows(data || []);
    setLatest((await getRate()) || 0);
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault(); setBusy(true); setError("");
    const amt = Number(f.amount);
    if (!(amt > 0)) { setError("Enter an amount greater than 0."); setBusy(false); return; }
    const fx = await getRate(f.date);
    const { error } = await supabase.from("salary").insert({ pay_date: f.date, employer: f.employer, description: f.description, amount: amt, fx_rate_inr: fx });
    if (error) setError(error.message); else { setF({ ...f, amount: "" }); load(); }
    setBusy(false);
  }
  async function del(id) {
    if (!confirm("Delete this deposit?")) return;
    await supabase.from("salary").delete().eq("id", id);
    load();
  }
  if (!rows) return null;

  let run = 0, runInr = 0;
  const list = rows.map((r) => {
    const fx = r.fx_rate_inr ?? latest;
    run += Number(r.amount); runInr += Number(r.amount) * fx;
    return { ...r, fx, run, inrAmt: Number(r.amount) * fx };
  });

  return (
    <>
      <h1>Salary</h1>
      <p className="sub">Record each pay deposit. These count as Salary income in your Annual Budget and Household totals.</p>
      <div className="grid" style={{ marginBottom: "1rem" }}>
        <div className="card stat"><small>Total earned</small><h2>{cad(run)}</h2><small>{inr(runInr)}</small></div>
        <div className="card stat"><small>Deposits recorded</small><h2>{rows.length}</h2></div>
      </div>
      <form className="card" onSubmit={add}>
        {error && <div className="msg err">{error}</div>}
        <div className="form-row">
          <label>Pay date<input type="date" required value={f.date} onChange={set("date")} /></label>
          <label>Employer<input value={f.employer} onChange={set("employer")} placeholder="e.g. Amazon" /></label>
          <label>Description<input value={f.description} onChange={set("description")} /></label>
          <label>Amount (CAD)<input type="number" step="0.01" min="0" required value={f.amount} onChange={set("amount")} /></label>
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Add deposit"}</button>
        </div>
      </form>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Date</th><th>Employer</th><th>Description</th><th className="num">Deposit</th><th className="num">Rate</th><th className="num">INR</th><th className="num">Running total</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={8} style={{ color: "var(--muted)" }}>No deposits yet. Add your first pay above.</td></tr>}
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.pay_date}</td><td>{r.employer}</td><td>{r.description}</td>
                <td className="num">{cad(r.amount)}</td>
                <td className="num">{r.fx_rate_inr ? Number(r.fx_rate_inr).toFixed(2) : "–"}</td>
                <td className="num">{inr(r.inrAmt)}</td>
                <td className="num">{cad(r.run)}</td>
                <td><button className="x" aria-label="Delete deposit" onClick={() => del(r.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3}>Total</td><td className="num">{cad(run)}</td><td></td><td className="num">{inr(runInr)}</td><td></td><td></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}
