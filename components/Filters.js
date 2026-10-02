"use client";
import { useState } from "react";
export const emptyFilters = { year: "", month: "", from: "", to: "", category: "", type: "", q: "" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// rows need: tx_date (YYYY-MM-DD), category, description, notes, expense, income
export function applyFilters(rows, f) {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) => {
    const d = r.tx_date;
    if (f.year && d.slice(0, 4) !== f.year) return false;
    if (f.month && d.slice(5, 7) !== f.month) return false;
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.type === "expense" && !(Number(r.expense) > 0)) return false;
    if (f.type === "income" && !(Number(r.income) > 0)) return false;
    if (q && !`${r.description || ""} ${r.notes || ""} ${r.category || ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
export const isFiltered = (f) => JSON.stringify(f) !== JSON.stringify(emptyFilters);

export function FilterBar({ f, setF, rows, categories, labels = ["Expense", "Income"], showCategory = true, showType = true }) {
  const [open, setOpen] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const years = [...new Set(rows.map((r) => r.tx_date.slice(0, 4)))].sort().reverse();
  const active = ["year", "month", "from", "to", "category", "type"].filter((k) => f[k]).length;
  return (
    <div style={{ marginTop: "1rem" }}>
      <div className="searchrow">
        <input className="sel" placeholder="Search description or notes" value={f.q} onChange={set("q")} aria-label="Search" />
        <button type="button" className="btn ghost" onClick={() => setOpen(!open)} aria-expanded={open}>Filters{active ? ` (${active})` : ""}</button>
        {isFiltered(f) && <button type="button" className="btn ghost" onClick={() => setF(emptyFilters)}>Clear</button>}
      </div>
      {open && (
        <div className="card" style={{ marginTop: ".6rem" }}>
          <div className="filters" style={{ marginTop: 0 }}>
            <label>Year<select value={f.year} onChange={set("year")}><option value="">All years</option>{years.map((y) => <option key={y}>{y}</option>)}</select></label>
            <label>Month<select value={f.month} onChange={set("month")}><option value="">All months</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}</select></label>
            <label>From<input type="date" value={f.from} onChange={set("from")} /></label>
            <label>To<input type="date" value={f.to} onChange={set("to")} /></label>
            {showCategory && <label>Category<select value={f.category} onChange={set("category")}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>}
            {showType && <label>Type<select value={f.type} onChange={set("type")}><option value="">All</option><option value="expense">{labels[0]} only</option><option value="income">{labels[1]} only</option></select></label>}
          </div>
        </div>
      )}
    </div>
  );
}
