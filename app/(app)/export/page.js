"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getRates } from "@/lib/fx";
import { getCfg } from "@/lib/settings";
import "@/components/tx.css";

const loadExcel = async () => { const m = await import("exceljs/dist/exceljs.min.js"); return m.default || m; };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const asDate = (d) => new Date(d + "T00:00:00Z");

function sheet(wb, name, cols, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = cols.map(([header, key, width, fmt]) => ({ header, key, width, style: fmt ? { numFmt: fmt } : {} }));
  rows.forEach((r) => ws.addRow(r));
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}
const $ = '#,##0.00', D = "dd mmm yyyy";

export default function ExportImport() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [target, setTarget] = useState("bank");
  const [skipDup, setSkipDup] = useState(true);
  const [accId, setAccId] = useState("");
  const [sheets, setSheets] = useState([]);
  const [sheetName, setSheetName] = useState("");
  const wbRef = useRef(null);

  useEffect(() => { supabase.from("accounts").select("*").order("created_at").then(({ data }) => setAccounts(data || [])); }, []);
  const accOpts = accounts.filter((a) => a.kind === target);
  useEffect(() => { setAccId(accOpts[0]?.id || ""); }, [target, accounts]);

  async function doExport() {
    setBusy(true); setMsg(null);
    try {
      const [{ data: acc }, { data: tx }, { data: sal }] = await Promise.all([
        supabase.from("accounts").select("*").order("created_at"),
        supabase.from("transactions").select("*").order("tx_date").order("created_at"),
        supabase.from("salary").select("*").order("pay_date").order("created_at"),
      ]);
      const ExcelJS = await loadExcel();
      const wb = new ExcelJS.Workbook();
      const byAcc = Object.fromEntries(acc.map((a) => [a.id, a]));
      const bal = Object.fromEntries(acc.map((a) => [a.id, Number(a.kind === "card" ? a.credit_limit : a.opening_balance) || 0]));
      const mk = (kind) => tx.filter((t) => byAcc[t.account_id]?.kind === kind).map((t) => {
        bal[t.account_id] += Number(t.income) - Number(t.expense);
        const a = byAcc[t.account_id], fx = Number(t.fx_rate_inr) || 0;
        return { year: Number(t.tx_date.slice(0, 4)), month: MON[Number(t.tx_date.slice(5, 7)) - 1], date: asDate(t.tx_date), account: `${a.institution} - ${a.name}`, category: t.category, description: t.description, out: Number(t.expense) || null, inn: Number(t.income) || null, notes: t.notes, fx: fx || null, inr: (Number(t.income) - Number(t.expense)) * fx, bal: bal[t.account_id] };
      });
      const cols = (o, i, b) => [["Year", "year", 8], ["Month", "month", 8], ["Date", "date", 14, D], ["Account", "account", 24], ["Category", "category", 18], ["Description", "description", 24], [o, "out", 13, $], [i, "inn", 13, $], ["Notes", "notes", 30], [`${getCfg().base} to ${getCfg().second}`, "fx", 11, "0.00"], [`${getCfg().second} amount`, "inr", 15, "#,##0"], [b, "bal", 16, $]];
      sheet(wb, "Bank Transactions", cols("Expense", "Income", "Balance"), mk("bank"));
      sheet(wb, "Card Transactions", cols("Debit", "Credit", "Credit Remaining"), mk("card"));
      let run = 0;
      sheet(wb, "Salary", [["Date", "date", 14, D], ["Employer", "employer", 20], ["Description", "description", 24], ["Amount", "amount", 14, $], [`${getCfg().base} to ${getCfg().second}`, "fx", 11, "0.00"], [`${getCfg().second} amount`, "inr", 15, "#,##0"], ["Total", "run", 16, $]],
        [
          ...tx.filter((t) => t.category === "Salary" && Number(t.income) > 0 && byAcc[t.account_id]?.kind === "bank").map((t) => ({ d: t.tx_date, employer: `${byAcc[t.account_id].institution} - ${byAcc[t.account_id].name}`, description: t.description, amount: Number(t.income), fx: Number(t.fx_rate_inr) || 0 })),
          ...sal.map((s) => ({ d: s.pay_date, employer: s.employer, description: s.description, amount: Number(s.amount), fx: Number(s.fx_rate_inr) || 0 })),
        ].sort((a, b) => a.d.localeCompare(b.d)).map((s) => { run += s.amount; return { date: asDate(s.d), employer: s.employer, description: s.description, amount: s.amount, fx: s.fx || null, inr: s.amount * s.fx, run }; }));
      sheet(wb, "Accounts", [["Type", "kind", 10], ["Institution", "inst", 18], ["Name", "name", 22], ["Opening balance / credit limit", "start", 24, $], ["Current balance / credit remaining", "now", 28, $]],
        acc.map((a) => ({ kind: a.kind, inst: a.institution, name: a.name, start: Number(a.kind === "card" ? a.credit_limit : a.opening_balance) || 0, now: bal[a.id] })));
      const sum = {};
      tx.forEach((t) => { const k = `${t.tx_date.slice(0, 7)}|${t.category}`; sum[k] ||= { out: 0, inn: 0 }; sum[k].out += Number(t.expense); sum[k].inn += Number(t.income); });
      sheet(wb, "Monthly Summary", [["Year", "y", 8], ["Month", "m", 8], ["Category", "c", 20], ["Expense / Debit", "o", 16, $], ["Income / Credit", "i", 16, $]],
        Object.entries(sum).sort().map(([k, v]) => { const [ym, c] = k.split("|"); return { y: Number(ym.slice(0, 4)), m: MON[Number(ym.slice(5)) - 1], c, o: v.out, i: v.inn }; }));
      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      a.download = `family-finance-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("profiles").update({ last_backup: new Date().toISOString() }).eq("user_id", user.id);
      setMsg({ ok: true, t: "Your Excel file has been downloaded." });
    } catch (e) { setMsg({ ok: false, t: "Export failed: " + e.message }); }
    setBusy(false);
  }

  async function pickFile(e) {
    const file = e.target.files[0]; setMsg(null);
    if (!file) return;
    try {
      const ExcelJS = await loadExcel();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      wbRef.current = wb;
      const names = wb.worksheets.map((w) => w.name);
      setSheets(names); setSheetName(names[0] || "");
    } catch (err) { setMsg({ ok: false, t: "Could not read that file. Please choose an .xlsx file." }); }
  }

  const val = (c) => { const v = c?.value; if (v && typeof v === "object" && !(v instanceof Date)) return v.result ?? v.text ?? (v.richText ? v.richText.map((r) => r.text).join("") : ""); return v ?? ""; };
  const toDate = (v) => { if (v instanceof Date) return v.toISOString().slice(0, 10); const d = new Date(String(v).replace(",", "")); return isNaN(d) ? null : d.toISOString().slice(0, 10); };
  const num = (v) => { const n = Number(String(v).replace(/[$,\s]/g, "")); return isNaN(n) ? 0 : n; };

  async function doImport() {
    setBusy(true); setMsg(null);
    try {
      const ws = wbRef.current.getWorksheet(sheetName);
      let hr = 0;
      ws.eachRow((row, n) => { if (!hr && row.values.some((v) => String(val({ value: v })).trim().toLowerCase() === "date")) hr = n; });
      if (!hr) throw new Error("No header row with a 'Date' column was found.");
      const idx = {};
      ws.getRow(hr).eachCell((c, i) => { idx[String(val(c)).trim().toLowerCase()] = i; });
      const col = (...names) => names.map((n) => idx[n]).find(Boolean);
      const cDate = col("date"), cCat = col("category"), cDesc = col("description"), cOut = col("expense", "debit"), cIn = col("income", "credit"), cNotes = col("notes"), cAmt = col("amount", "debit", "deposit"), cEmp = col("employer");
      const cats = target === "card" ? getCfg().cardCats : getCfg().bankCats;
      let items = []; let skipped = 0, dupes = 0;
      for (let n = hr + 1; n <= ws.rowCount; n++) {
        const r = ws.getRow(n);
        const date = toDate(val(r.getCell(cDate)));
        if (!date || !/^\d{4}-/.test(date)) { if (val(r.getCell(cDate)) !== "") skipped++; continue; }
        if (target === "salary") {
          const amount = num(val(r.getCell(cAmt)));
          if (amount > 0) items.push({ date, employer: cEmp ? String(val(r.getCell(cEmp))) : "", description: cDesc ? String(val(r.getCell(cDesc))) : "Salary", amount }); else skipped++;
        } else {
          const expense = cOut ? num(val(r.getCell(cOut))) : 0, income = cIn ? num(val(r.getCell(cIn))) : 0;
          if (!expense && !income) { skipped++; continue; }
          const raw = cCat ? String(val(r.getCell(cCat))).trim() : "";
          items.push({ date, category: cats.find((c) => c.toLowerCase() === raw.toLowerCase()) || "Others", description: cDesc ? String(val(r.getCell(cDesc))) : "", notes: cNotes ? String(val(r.getCell(cNotes))) : "", expense, income });
        }
      }
      if (!items.length) throw new Error("No usable rows found in that sheet.");
      if (target !== "salary" && !accId) throw new Error("Choose an account first.");
      if (skipDup) {
        const ds = items.map((i) => i.date).sort();
        const { data: ex } = await supabase.from("transactions").select("tx_date,description,expense,income").eq("account_id", accId).gte("tx_date", ds[0]).lte("tx_date", ds[ds.length - 1]);
        const key = (d, amt, desc) => `${d}|${amt}|${(desc || "").trim().toLowerCase()}`;
        const have = new Set((ex || []).map((x) => key(x.tx_date, Number(x.expense) || Number(x.income), x.description)));
        const before = items.length;
        items = items.filter((i) => !have.has(key(i.date, i.expense || i.income, i.description)));
        dupes = before - items.length;
        if (!items.length) throw new Error("Every row in that sheet already exists in this account.");
      }
      const rates = await getRates(items.map((i) => i.date));
      const rows = items.map((i) => target === "salary"
        ? { pay_date: i.date, employer: i.employer, description: i.description, amount: i.amount, fx_rate_inr: rates[i.date] }
        : { account_id: accId, tx_date: i.date, category: i.category, description: i.description, notes: i.notes, expense: i.expense, income: i.income, fx_rate_inr: rates[i.date] });
      for (let k = 0; k < rows.length; k += 200) {
        const { error } = await supabase.from(target === "salary" ? "salary" : "transactions").insert(rows.slice(k, k + 200));
        if (error) throw error;
      }
      setMsg({ ok: true, t: `Imported ${rows.length} rows with daily exchange rates.${skipped ? ` Skipped ${skipped} empty or total rows.` : ""}${dupes ? ` Skipped ${dupes} duplicates that already existed.` : ""}` });
    } catch (e) { setMsg({ ok: false, t: "Import failed: " + (e.message || e) }); }
    setBusy(false);
  }

  return (
    <>
      <h1>Export & backup</h1>
      <p className="sub">Download everything as Excel whenever you need it. To add transactions from a bank statement, use Import statement instead.</p>
      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.t}</div>}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3>Export to Excel</h3>
        <p className="sub">One file with tabs for Bank Transactions, Card Transactions, Salary, Accounts and a Monthly Summary. Year and Month columns are included so you can build pivot tables.</p>
        <button className="btn" disabled={busy} onClick={doExport}>{busy ? "Working…" : "Download Excel file"}</button>
      </div>
      <div className="card">
        <h3>Import from our Excel layout (advanced)</h3>
        <p className="sub">Use a sheet with a header row like your old ones: Date, Category, Description, Expense/Debit, Income/Credit, Notes. Import salary as bank transactions with the category Salary; it then appears on the Salary tab automatically. Imported rows get that day's exchange rate.</p>
        <div className="form-row">
          <label>What are you importing?<select className="sel" value={target} onChange={(e) => setTarget(e.target.value)}><option value="bank">Bank transactions</option><option value="card">Card transactions</option></select></label>
          {target !== "salary" && (
            <label>Account<select className="sel" value={accId} onChange={(e) => setAccId(e.target.value)}>{accOpts.length === 0 && <option value="">Add an account first</option>}{accOpts.map((a) => <option key={a.id} value={a.id}>{a.institution} – {a.name}</option>)}</select></label>
          )}
          <label>Excel file<input type="file" accept=".xlsx" onChange={pickFile} /></label>
          {sheets.length > 0 && <label>Sheet<select className="sel" value={sheetName} onChange={(e) => setSheetName(e.target.value)}>{sheets.map((n) => <option key={n}>{n}</option>)}</select></label>}
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center", flexDirection: "row" }}><input type="checkbox" checked={skipDup} onChange={(ev) => setSkipDup(ev.target.checked)} style={{ width: 16 }} />Skip duplicates</label>
          <button className="btn" disabled={busy || !sheets.length} onClick={doImport}>{busy ? "Importing…" : "Import"}</button>
        </div>
        <p className="sub" style={{ margin: ".75rem 0 0", fontSize: ".85rem" }}>Import each sheet once. Importing the same sheet twice adds duplicate rows. Unknown categories are saved as Others.</p>
      </div>
    </>
  );
}
