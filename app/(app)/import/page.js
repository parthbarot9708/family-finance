"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getRates } from "@/lib/fx";
import { cad } from "@/lib/format";
import { getCfg } from "@/lib/settings";
import { parseCSV, analyze, suggestCategory } from "@/lib/statement";
import "@/components/tx.css";

const loadExcel = async () => { const m = await import("exceljs/dist/exceljs.min.js"); return m.default || m; };
const cellVal = (c) => { const v = c?.value; if (v && typeof v === "object" && !(v instanceof Date)) return v.result ?? v.text ?? (v.richText ? v.richText.map((r) => r.text).join("") : ""); return v ?? ""; };

export default function ImportStatement() {
  const cfg = getCfg();
  const [accounts, setAccounts] = useState(null);
  const [accId, setAccId] = useState("");
  const [file, setFile] = useState("");
  const [raw, setRaw] = useState(null);
  const [flip, setFlip] = useState(false);
  const [order, setOrder] = useState("auto");
  const [ov, setOv] = useState({ date: "", desc: "", debit: "", credit: "", amount: "" });
  const [incl, setIncl] = useState({});
  const [catOv, setCatOv] = useState({});
  const [have, setHave] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    supabase.from("accounts").select("*").order("created_at").then(({ data }) => { setAccounts(data || []); if (data?.[0]) setAccId(data[0].id); });
  }, []);

  const acc = accounts?.find((a) => a.id === accId);
  const result = raw && acc ? analyze(raw, { kind: acc.kind, flip, order, ov, base: cfg.base }) : null;
  const rows = result?.rows || [];
  const cats = acc?.kind === "card" ? cfg.cardCats : cfg.bankCats;
  const first = rows[0]?.date, last = rows[rows.length - 1]?.date;

  // find entries already saved on the same day with the same amount
  useEffect(() => {
    if (!accId || !first) { setHave(new Set()); return; }
    supabase.from("transactions").select("tx_date,expense,income").eq("account_id", accId).gte("tx_date", first).lte("tx_date", last).then(({ data }) => {
      setHave(new Set((data || []).map((x) => `${x.tx_date}|${(Number(x.expense) || Number(x.income)).toFixed(2)}`)));
    });
  }, [accId, first, last, rows.length]);

  async function pickFile(e) {
    const f = e.target.files[0];
    setMsg(null); setRaw(null); setIncl({}); setCatOv({}); setFlip(false); setOrder("auto"); setOv({ date: "", desc: "", debit: "", credit: "", amount: "" });
    if (!f) return;
    setFile(f.name);
    try {
      const ext = f.name.split(".").pop().toLowerCase();
      if (ext === "xlsx") {
        const ExcelJS = await loadExcel();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await f.arrayBuffer());
        const ws = [...wb.worksheets].sort((a, b) => b.rowCount - a.rowCount)[0];
        const out = [];
        ws.eachRow({ includeEmpty: false }, (row) => out.push(row.values.slice(1).map(cellVal)));
        setRaw(out);
      } else if (ext === "csv" || ext === "txt") setRaw(parseCSV(await f.text()));
      else setMsg({ ok: false, t: ext === "pdf" ? "PDF statements are coming soon. For now, download your transactions as CSV or Excel from online banking." : "Please choose a CSV or Excel (.xlsx) file. If yours is .xls, open it and save as .xlsx first." });
    } catch { setMsg({ ok: false, t: "Sorry, I could not read that file." }); }
  }

  const dupOf = (r) => have.has(`${r.date}|${(r.expense || r.income).toFixed(2)}`);
  const on = (i, r) => incl[i] ?? !dupOf(r);
  const catOf = (i, r) => catOv[i] ?? suggestCategory(r.desc, r.income > 0, cats);
  const chosen = rows.map((r, i) => ({ r, i })).filter(({ r, i }) => on(i, r));
  const tOut = chosen.reduce((s, { r }) => s + r.expense, 0), tIn = chosen.reduce((s, { r }) => s + r.income, 0);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const rates = await getRates(chosen.map(({ r }) => r.date));
      const body = chosen.map(({ r, i }) => ({ account_id: accId, tx_date: r.date, category: catOf(i, r), description: r.desc, notes: "Imported from statement", expense: r.expense, income: r.income, fx_rate_inr: rates[r.date] }));
      for (let k = 0; k < body.length; k += 200) {
        const { error } = await supabase.from("transactions").insert(body.slice(k, k + 200));
        if (error) throw error;
      }
      setMsg({ ok: true, t: `Imported ${body.length} transactions into ${acc.institution} – ${acc.name}.`, done: true });
      setRaw(null); setFile(""); if (fileRef.current) fileRef.current.value = "";
    } catch (e) { setMsg({ ok: false, t: "Import failed: " + (e.message || e) }); }
    setBusy(false);
  }

  if (!accounts) return null;
  if (accounts.length === 0)
    return (<><h1>Import statement</h1><p className="sub">Add a bank account or card first, then upload its statement here.</p><Link className="btn" href="/accounts">Add an account</Link></>);

  const setO = (k) => (e) => setOv({ ...ov, [k]: e.target.value });
  const colSelect = (k, label) => (
    <label>{label}<select className="sel" value={ov[k]} onChange={setO(k)}><option value="">Automatic</option>{(result?.info?.labels || []).map((l, i) => <option key={i} value={i}>{l}</option>)}</select></label>
  );

  return (
    <>
      <h1>Import statement</h1>
      <p className="sub">Upload the CSV or Excel statement from your bank or card. Your file is read in your browser and never uploaded. Only the transactions you confirm are saved.</p>
      {msg && (<div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.t} {msg.done && <Link href={acc.kind === "card" ? "/cards" : "/bank"} style={{ color: "inherit", fontWeight: 700 }}>View them</Link>}</div>)}

      <div className="card">
        <div className="form-row">
          <label>1. Which account is this for?<select className="sel" value={accId} onChange={(e) => { setAccId(e.target.value); setIncl({}); setCatOv({}); }}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.institution} – {a.name} ({a.kind === "card" ? "card" : "bank"})</option>)}</select></label>
          <label>2. Choose the statement file<input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.pdf" onChange={pickFile} /></label>
        </div>
        <p className="sub" style={{ margin: ".75rem 0 0", fontSize: ".85rem" }}>In online banking, look for “Download transactions” and choose CSV or Excel. Works with the usual Canadian and Indian bank and card formats.</p>
      </div>

      {raw && result?.error && <div className="msg err" style={{ marginTop: "1rem" }}>{result.error}</div>}

      {raw && (
        <details className="card" style={{ marginTop: "1rem" }} open={!!result?.error}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Fix the columns (only if something looks wrong)</summary>
          <div className="form-row" style={{ marginTop: ".75rem" }}>
            {colSelect("date", "Date column")}{colSelect("desc", "Description column")}{colSelect("debit", "Money out column")}{colSelect("credit", "Money in column")}{colSelect("amount", "Single amount column")}
            <label>Date order<select className="sel" value={order} onChange={(e) => setOrder(e.target.value)}><option value="auto">Automatic</option><option value="dmy">Day / Month / Year</option><option value="mdy">Month / Day / Year</option></select></label>
          </div>
        </details>
      )}

      {raw && rows.length > 0 && (
        <>
          <div className="card" style={{ marginTop: "1rem" }}>
            <strong>{file}</strong>{result.info.bank && <span className="chip" style={{ marginLeft: ".5rem" }}>Looks like {result.info.bank}</span>}
            <p className="sub" style={{ margin: ".4rem 0 0", fontSize: ".85rem" }}>{rows.length} transactions found, {first} to {last}. {result.info.used}</p>
            <label style={{ display: "flex", gap: ".5rem", alignItems: "center", marginTop: ".6rem", fontSize: ".9rem" }}>
              <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} style={{ width: 16, height: 16 }} />Spending and income look swapped? Tick to reverse them.
            </label>
          </div>

          <div className="barrow">
            <span><strong style={{ color: "var(--ink)" }}>{chosen.length}</strong> selected · spending {cad(tOut)} · income {cad(tIn)}</span>
            <button type="button" className="btn ghost sm" onClick={() => setIncl(Object.fromEntries(rows.map((_, i) => [i, true])))}>Select all</button>
            <button type="button" className="btn ghost sm" onClick={() => setIncl(Object.fromEntries(rows.map((_, i) => [i, false])))}>Select none</button>
          </div>

          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th className="chk"></th><th>Date</th><th>Description</th><th>Category</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={on(i, r) ? {} : { opacity: 0.55 }}>
                    <td className="chk"><input type="checkbox" aria-label="Include" checked={on(i, r)} onChange={(e) => setIncl({ ...incl, [i]: e.target.checked })} /></td>
                    <td className="dt">{r.date}</td>
                    <td className="txt">{r.desc}{dupOf(r) && <small style={{ display: "block", color: "var(--gold)" }}>Possible duplicate: same day and amount already saved</small>}</td>
                    <td><select className="sel" style={{ minWidth: 140, padding: ".35rem" }} value={catOf(i, r)} onChange={(e) => setCatOv({ ...catOv, [i]: e.target.value })}>{(cats.includes(catOf(i, r)) ? cats : [...cats, catOf(i, r)]).map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td className={`num ${r.expense ? "neg" : "pos"}`}>{r.expense ? "−" + cad(r.expense) : "+" + cad(r.income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "1rem", display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
            <button className="btn" disabled={busy || chosen.length === 0} onClick={save}>{busy ? "Importing…" : `Import ${chosen.length} transactions`}</button>
            <button className="btn ghost" onClick={() => { setRaw(null); setFile(""); if (fileRef.current) fileRef.current.value = ""; }}>Cancel</button>
          </div>
        </>
      )}
    </>
  );
}
