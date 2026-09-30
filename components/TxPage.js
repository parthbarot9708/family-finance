"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getRate } from "@/lib/fx";
import { cad, inr } from "@/lib/format";
import "./tx.css";

export default function TxPage({ kind, title, categories }) {
  const isCard = kind === "card";
  const L = isCard ? { out: "Debit", inn: "Credit" } : { out: "Expense", inn: "Income" };
  const today = new Date().toISOString().slice(0, 10);
  const [accounts, setAccounts] = useState(null);
  const [accId, setAccId] = useState("");
  const [rows, setRows] = useState([]);
  const [latest, setLatest] = useState(null);
  const [f, setF] = useState({ date: today, category: categories[0], description: "", notes: "", type: "expense", amount: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("accounts").select("*").eq("kind", kind).order("created_at");
      setAccounts(data || []);
      if (data?.[0]) setAccId(data[0].id);
      setLatest(await getRate());
    })();
  }, [kind]);

  async function loadRows(id) {
    const { data } = await supabase.from("transactions").select("*").eq("account_id", id).order("tx_date").order("created_at");
    setRows(data || []);
  }
  useEffect(() => { accId ? loadRows(accId) : setRows([]); }, [accId]);

  async function add(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const amt = Number(f.amount);
    if (!(amt > 0)) { setError("Enter an amount greater than 0."); setBusy(false); return; }
    const fx = await getRate(f.date);
    const { error } = await supabase.from("transactions").insert({
      account_id: accId, tx_date: f.date, category: f.category, description: f.description, notes: f.notes,
      expense: f.type === "expense" ? amt : 0, income: f.type === "income" ? amt : 0, fx_rate_inr: fx,
    });
    if (error) setError(error.message);
    else { setF({ ...f, description: "", notes: "", amount: "" }); loadRows(accId); }
    setBusy(false);
  }
  async function del(id) {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("transactions").delete().eq("id", id);
    loadRows(accId);
  }

  if (!accounts) return null;
  if (accounts.length === 0)
    return (
      <>
        <h1>{title}</h1>
        <p className="sub">Add a {isCard ? "credit card" : "bank account"} first, then come back to record transactions.</p>
        <Link className="btn" href="/accounts">Go to Accounts</Link>
      </>
    );

  const acc = accounts.find((a) => a.id === accId);
  let bal = Number(isCard ? acc?.credit_limit : acc?.opening_balance) || 0;
  const list = rows.map((r) => {
    bal += isCard ? Number(r.income) - Number(r.expense) : Number(r.income) - Number(r.expense);
    return { ...r, bal, fx: r.fx_rate_inr ?? latest ?? 0 };
  });
  const tOut = rows.reduce((s, r) => s + Number(r.expense), 0);
  const tIn = rows.reduce((s, r) => s + Number(r.income), 0);
  const iOut = list.reduce((s, r) => s + Number(r.expense) * r.fx, 0);
  const iIn = list.reduce((s, r) => s + Number(r.income) * r.fx, 0);

  return (
    <>
      <h1>{title}</h1>
      <p className="sub">Each entry saves that day's CAD to INR rate. Latest rate: {latest ? `₹${latest.toFixed(2)}` : "unavailable"}.</p>
      <div style={{ maxWidth: 320, marginBottom: "1rem" }}>
        <select className="sel" value={accId} onChange={(e) => setAccId(e.target.value)} aria-label="Account">
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.institution} – {a.name}</option>)}
        </select>
      </div>

      <div className="grid" style={{ marginBottom: "1rem" }}>
        <div className="card stat"><small>{isCard ? "Credit remaining" : "Balance"}</small><h2 className={bal < 0 ? "neg" : ""}>{cad(bal)}</h2><small>{inr(bal * (latest || 0))}</small></div>
        {isCard && <div className="card stat"><small>Bill amount</small><h2>{cad(Math.max(0, tOut - tIn))}</h2><small>{inr(Math.max(0, tOut - tIn) * (latest || 0))}</small></div>}
        <div className="card stat"><small>Total {L.out.toLowerCase()}</small><h2>{cad(tOut)}</h2><small>{inr(iOut)}</small></div>
        <div className="card stat"><small>Total {L.inn.toLowerCase()}</small><h2>{cad(tIn)}</h2><small>{inr(iIn)}</small></div>
      </div>

      <form className="card" onSubmit={add}>
        {error && <div className="msg err">{error}</div>}
        <div className="form-row">
          <label>Date<input type="date" required value={f.date} onChange={set("date")} /></label>
          <label>Category<select className="sel" value={f.category} onChange={set("category")}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Description<input value={f.description} onChange={set("description")} placeholder="e.g. No Frills" /></label>
          <label>Type<select className="sel" value={f.type} onChange={set("type")}><option value="expense">{L.out}</option><option value="income">{L.inn}</option></select></label>
          <label>Amount (CAD)<input type="number" step="0.01" min="0" required value={f.amount} onChange={set("amount")} /></label>
          <label>Notes<input value={f.notes} onChange={set("notes")} placeholder="Optional" /></label>
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Add entry"}</button>
        </div>
      </form>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Notes</th><th className="num">{L.out}</th><th className="num">{L.inn}</th><th className="num">Rate</th><th className="num">INR</th><th className="num">{isCard ? "Credit remaining" : "Balance"}</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={10} style={{ color: "var(--muted)" }}>No entries yet. Add your first one above.</td></tr>}
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.tx_date}</td><td>{r.category}</td><td>{r.description}</td><td>{r.notes}</td>
                <td className="num">{Number(r.expense) ? cad(r.expense) : "–"}</td>
                <td className="num">{Number(r.income) ? cad(r.income) : "–"}</td>
                <td className="num">{r.fx_rate_inr ? Number(r.fx_rate_inr).toFixed(2) : "–"}</td>
                <td className="num">{inr((Number(r.income) - Number(r.expense)) * r.fx)}</td>
                <td className={`num ${r.bal < 0 ? "neg" : ""}`}>{cad(r.bal)}</td>
                <td><button className="x" aria-label="Delete entry" onClick={() => del(r.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={4}>Total</td><td className="num">{cad(tOut)}</td><td className="num">{cad(tIn)}</td><td></td><td className="num">{inr(iIn - iOut)}</td><td></td><td></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}
