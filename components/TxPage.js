"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getRate } from "@/lib/fx";
import { cad, inr } from "@/lib/format";
import { getCfg } from "@/lib/settings";
import { FilterBar, applyFilters, emptyFilters, isFiltered } from "./Filters";
import "./tx.css";

export default function TxPage({ kind, title, categories }) {
  const isCard = kind === "card";
  const L = isCard ? { out: "Debit", inn: "Credit" } : { out: "Expense", inn: "Income" };
  const today = new Date().toISOString().slice(0, 10);
  const blank = { date: today, category: categories[0], description: "", notes: "", type: "expense", amount: "" };
  const [accounts, setAccounts] = useState(null);
  const [accId, setAccId] = useState("");
  const [rows, setRows] = useState([]);
  const [latest, setLatest] = useState(null);
  const [f, setF] = useState(blank);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [flt, setFlt] = useState(emptyFilters);
  const [sel, setSel] = useState(new Set());
  const [newest, setNewest] = useState(true);
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
  useEffect(() => { accId ? loadRows(accId) : setRows([]); setSel(new Set()); setEditing(null); setShowForm(false); }, [accId]);
  useEffect(() => { setSel(new Set()); }, [flt]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    const amt = Number(f.amount);
    if (!(amt > 0)) { setError("Enter an amount greater than 0."); setBusy(false); return; }
    const body = { tx_date: f.date, category: f.category, description: f.description, notes: f.notes, expense: f.type === "expense" ? amt : 0, income: f.type === "income" ? amt : 0 };
    if (!editing) {
      const { data: dup } = await supabase.from("transactions").select("id").eq("tx_date", f.date).eq("description", f.description).or(`expense.eq.${amt},income.eq.${amt}`).limit(1);
      if (dup?.length && !confirm("An entry with the same date, amount and description already exists. Add it anyway?")) { setBusy(false); return; }
    }
    let err;
    if (editing) {
      const fx = editing.tx_date === f.date && editing.fx_rate_inr ? editing.fx_rate_inr : await getRate(f.date);
      ({ error: err } = await supabase.from("transactions").update({ ...body, fx_rate_inr: fx }).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("transactions").insert({ ...body, account_id: accId, fx_rate_inr: await getRate(f.date) }));
    }
    if (err) setError(err.message);
    else {
      if (editing) { setEditing(null); setShowForm(false); setF(blank); }
      else setF({ ...blank, date: f.date, category: f.category });
      loadRows(accId);
    }
    setBusy(false);
  }
  function openAdd() { setEditing(null); setF(blank); setError(""); setShowForm(true); }
  function startEdit(r) {
    setEditing(r); setError(""); setShowForm(true);
    const inc = Number(r.income) > 0;
    setF({ date: r.tx_date, category: r.category, description: r.description || "", notes: r.notes || "", type: inc ? "income" : "expense", amount: String(inc ? r.income : r.expense) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeForm() { setEditing(null); setShowForm(false); setF(blank); setError(""); }
  async function removeMany(ids) {
    if (!ids.length || !confirm(`Delete ${ids.length} ${ids.length === 1 ? "entry" : "entries"}? This cannot be undone.`)) return;
    const { error } = await supabase.from("transactions").delete().in("id", ids);
    if (error) setError(error.message);
    setSel(new Set()); loadRows(accId);
  }

  if (!accounts) return null;
  if (accounts.length === 0)
    return (
      <>
        <h1>{title}</h1>
        <p className="sub">Add a {isCard ? "credit card" : "bank account"} first, then come back to record transactions.</p>
        <Link className="btn" href="/accounts">Add an account</Link>
      </>
    );

  const acc = accounts.find((a) => a.id === accId);
  let bal = Number(isCard ? acc?.credit_limit : acc?.opening_balance) || 0;
  const all = rows.map((r) => { bal += Number(r.income) - Number(r.expense); return { ...r, bal, fx: r.fx_rate_inr ?? latest ?? 0 }; });
  const filtered = applyFilters(all, flt);
  const list = newest ? [...filtered].reverse() : filtered;
  const tOutAll = rows.reduce((s, r) => s + Number(r.expense), 0);
  const tInAll = rows.reduce((s, r) => s + Number(r.income), 0);
  const tOut = filtered.reduce((s, r) => s + Number(r.expense), 0);
  const tIn = filtered.reduce((s, r) => s + Number(r.income), 0);
  const iOut = filtered.reduce((s, r) => s + Number(r.expense) * r.fx, 0);
  const iIn = filtered.reduce((s, r) => s + Number(r.income) * r.fx, 0);
  const tag = isFiltered(flt) ? " (filtered)" : "";
  const allSel = list.length > 0 && list.every((r) => sel.has(r.id));
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };

  return (
    <>
      <div className="pagehead">
        <h1>{title}</h1>
        {!showForm && <button className="btn" onClick={openAdd}>+ Add entry</button>}
      </div>
      {accounts.length > 1 ? (
        <div style={{ maxWidth: 320, margin: ".5rem 0 1rem" }}>
          <select className="sel" value={accId} onChange={(e) => setAccId(e.target.value)} aria-label="Account">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.institution} – {a.name}</option>)}
          </select>
        </div>
      ) : <p className="sub">{acc.institution} – {acc.name}</p>}

      <div className="grid" style={{ marginBottom: "1rem" }}>
        <div className="card stat"><small>{isCard ? "Credit remaining" : "Balance"}</small><h2 className={bal < 0 ? "neg" : ""}>{cad(bal)}</h2><small>{inr(bal * (latest || 0))}</small></div>
        {isCard && <div className="card stat"><small>Bill amount</small><h2>{cad(Math.max(0, tOutAll - tInAll))}</h2><small>{inr(Math.max(0, tOutAll - tInAll) * (latest || 0))}</small></div>}
        <div className="card stat"><small>{L.out === "Debit" ? "Spent" : "Spent"}{tag}</small><h2>{cad(tOut)}</h2><small>{inr(iOut)}</small></div>
        <div className="card stat"><small>{isCard ? "Paid / refunded" : "Received"}{tag}</small><h2>{cad(tIn)}</h2><small>{inr(iIn)}</small></div>
      </div>

      {showForm && (
        <form className="card" onSubmit={submit} style={{ marginBottom: "1rem", ...(editing ? { borderColor: "var(--gold)" } : {}) }}>
          <div className="pagehead"><h3>{editing ? "Edit entry" : "New entry"}</h3><button type="button" className="btn ghost sm" onClick={closeForm}>Close</button></div>
          {error && <div className="msg err">{error}</div>}
          <div className="form-row">
            <label>Date<input type="date" required value={f.date} onChange={set("date")} /></label>
            <label>Type<select className="sel" value={f.type} onChange={set("type")}><option value="expense">{L.out}</option><option value="income">{L.inn}</option></select></label>
            <label>Amount ({getCfg().base})<input type="number" step="0.01" min="0" required value={f.amount} onChange={set("amount")} /></label>
            <label>Category<select className="sel" value={f.category} onChange={set("category")}>{(categories.includes(f.category) ? categories : [...categories, f.category]).map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Description<input value={f.description} onChange={set("description")} placeholder="e.g. No Frills" /></label>
            <label>Notes<input value={f.notes} onChange={set("notes")} placeholder="Optional" /></label>
            <button className="btn" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add entry"}</button>
          </div>
        </form>
      )}

      <FilterBar f={flt} setF={setFlt} rows={rows} categories={categories} labels={[L.out, L.inn]} />

      <div className="barrow">
        <span>{filtered.length} of {rows.length} entries</span>
        <button type="button" className="btn ghost sm" onClick={() => setNewest(!newest)}>{newest ? "Newest first" : "Oldest first"} ⇅</button>
        {sel.size > 0 && (
          <>
            <strong style={{ color: "var(--ink)" }}>{sel.size} selected</strong>
            <button type="button" className="btn danger sm" onClick={() => removeMany([...sel])}>Delete</button>
            <button type="button" className="btn ghost sm" onClick={() => setSel(new Set())}>Clear</button>
          </>
        )}
      </div>

      <div className="tbl-wrap">
        <table className="tbl tx">
          <thead><tr>
            <th className="chk"><input type="checkbox" aria-label="Select all" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(list.map((r) => r.id)))} /></th>
            <th>Date</th><th>Category</th><th>Description</th><th>Notes</th><th className="num">{L.out}</th><th className="num">{L.inn}</th><th className="num">Rate</th><th className="num">{getCfg().second}</th><th className="num">{isCard ? "Remaining" : "Balance"}</th><th></th>
          </tr></thead>
          <tbody>
            {list.length === 0 && <tr className="empty"><td colSpan={11} style={{ color: "var(--muted)" }}>{rows.length ? "No entries match these filters." : "No entries yet. Tap “+ Add entry” to start."}</td></tr>}
            {list.map((r) => (
              <tr key={r.id}>
                <td className="chk c-chk"><input type="checkbox" aria-label="Select row" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="dt c-date">{r.tx_date}</td>
                <td className="nw c-cat">{r.category}</td>
                <td className="txt c-desc">{r.description || r.category}<small className="m-only">{r.tx_date} · {r.category}{r.notes ? ` · ${r.notes}` : ""}</small></td>
                <td className="txt c-notes">{r.notes}</td>
                <td className={`num c-out ${Number(r.expense) ? "neg" : "zero"}`}>{Number(r.expense) ? <>{cad(r.expense)}<small className="m-only">{inr(Number(r.expense) * r.fx)}</small></> : "–"}</td>
                <td className={`num c-in ${Number(r.income) ? "pos" : "zero"}`}>{Number(r.income) ? <>{cad(r.income)}<small className="m-only">{inr(Number(r.income) * r.fx)}</small></> : "–"}</td>
                <td className="num c-rate">{r.fx_rate_inr ? Number(r.fx_rate_inr).toFixed(2) : "–"}</td>
                <td className="num c-inr">{inr((Number(r.income) - Number(r.expense)) * r.fx)}</td>
                <td className={`num c-bal ${r.bal < 0 ? "neg" : ""}`}>{cad(r.bal)}</td>
                <td className="nw c-act"><button className="x" title="Edit" aria-label="Edit entry" onClick={() => startEdit(r)}>✎</button><button className="x" title="Delete" aria-label="Delete entry" onClick={() => removeMany([r.id])}>✕</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td></td><td colSpan={4}>Total{tag}</td><td className="num">{cad(tOut)}</td><td className="num">{cad(tIn)}</td><td></td><td className="num">{inr(iIn - iOut)}</td><td></td><td></td></tr></tfoot>
        </table>
      </div>
    </>
  );
}
