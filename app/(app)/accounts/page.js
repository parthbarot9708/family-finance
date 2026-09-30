"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getRate } from "@/lib/fx";
import { cad, inr } from "@/lib/format";
import { BANKS, CARDS } from "@/lib/categories";
import "@/components/tx.css";

export default function Accounts() {
  const [accounts, setAccounts] = useState(null);
  const [tx, setTx] = useState([]);
  const [latest, setLatest] = useState(0);
  const [f, setF] = useState({ kind: "bank", institution: BANKS[0], name: "", amount: "" });
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function load() {
    const { data: a } = await supabase.from("accounts").select("*").order("created_at");
    const { data: t } = await supabase.from("transactions").select("account_id,income,expense,fx_rate_inr");
    setAccounts(a || []); setTx(t || []);
    setLatest((await getRate()) || 0);
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault(); setError("");
    const amt = Number(f.amount) || 0;
    const { error } = await supabase.from("accounts").insert({
      kind: f.kind, institution: f.institution, name: f.name || f.institution,
      opening_balance: f.kind === "bank" ? amt : 0, credit_limit: f.kind === "card" ? amt : null,
    });
    if (error) setError(error.message); else { setF({ ...f, name: "", amount: "" }); load(); }
  }
  async function del(a) {
    if (!confirm(`Delete ${a.institution} – ${a.name} and all its transactions?`)) return;
    await supabase.from("accounts").delete().eq("id", a.id);
    load();
  }
  if (!accounts) return null;

  const options = f.kind === "bank" ? BANKS : CARDS;
  return (
    <>
      <h1>Accounts</h1>
      <p className="sub">Your bank accounts and credit cards. Balances update as you add transactions.</p>
      <form className="card" onSubmit={add} style={{ marginBottom: "1.5rem" }}>
        {error && <div className="msg err">{error}</div>}
        <div className="form-row">
          <label>Type<select className="sel" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, institution: (e.target.value === "bank" ? BANKS : CARDS)[0] })}><option value="bank">Bank account</option><option value="card">Credit card</option></select></label>
          <label>{f.kind === "bank" ? "Bank" : "Card"}<select className="sel" value={f.institution} onChange={set("institution")}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>
          <label>Nickname<input value={f.name} onChange={set("name")} placeholder={f.kind === "bank" ? "Chequing" : "Cashback"} /></label>
          <label>{f.kind === "bank" ? "Opening balance (CAD)" : "Credit limit (CAD)"}<input type="number" step="0.01" value={f.amount} onChange={set("amount")} /></label>
          <button className="btn">Add account</button>
        </div>
      </form>

      {accounts.length === 0 && <p className="sub">No accounts yet. Add your first one above.</p>}
      <div className="grid">
        {accounts.map((a) => {
          const mine = tx.filter((t) => t.account_id === a.id);
          const inc = mine.reduce((s, t) => s + Number(t.income), 0);
          const exp = mine.reduce((s, t) => s + Number(t.expense), 0);
          const iInc = mine.reduce((s, t) => s + Number(t.income) * (t.fx_rate_inr ?? latest), 0);
          const iExp = mine.reduce((s, t) => s + Number(t.expense) * (t.fx_rate_inr ?? latest), 0);
          const isCard = a.kind === "card";
          const bal = (isCard ? Number(a.credit_limit) : Number(a.opening_balance)) + inc - exp;
          return (
            <div className="card stat" key={a.id}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{a.institution} – {a.name}</strong>
                <button className="x" aria-label="Delete account" onClick={() => del(a)}>✕</button>
              </div>
              <small>{isCard ? "Credit remaining" : "Balance"}</small>
              <h2 className={bal < 0 ? "neg" : ""}>{cad(bal)}</h2>
              <small>{inr(bal * latest)} at today's rate</small>
              <p style={{ margin: ".75rem 0 0", fontSize: ".9rem" }}>
                <span className="pos">In {cad(inc)} ({inr(iInc)})</span><br />
                <span className="neg">Out {cad(exp)} ({inr(iExp)})</span>
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
