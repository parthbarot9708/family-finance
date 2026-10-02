"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCfg } from "@/lib/settings";
import { cad } from "@/lib/format";
import "@/components/tx.css";

const SKIP = ["Salary", "CC Bill", "Int. Transfers"];
export default function Limits() {
  const cfg = getCfg();
  const cats = [...new Set([...cfg.bankCats, ...cfg.cardCats])].filter((c) => !SKIP.includes(c));
  const [vals, setVals] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("budgets").select("category,monthly_limit").then(({ data }) => setVals(Object.fromEntries((data || []).map((b) => [b.category, String(b.monthly_limit)]))));
  }, []);

  async function save() {
    const { data: { user } } = await supabase.auth.getUser();
    const up = [], del = [];
    cats.forEach((c) => { const v = Number(vals[c]); v > 0 ? up.push({ user_id: user.id, category: c, monthly_limit: v }) : del.push(c); });
    let err;
    if (up.length) ({ error: err } = await supabase.from("budgets").upsert(up, { onConflict: "user_id,category" }));
    if (!err && del.length) ({ error: err } = await supabase.from("budgets").delete().in("category", del));
    setMsg(err ? err.message : "Saved. Your Dashboard now tracks these limits.");
    setTimeout(() => setMsg(""), 3500);
  }
  if (!vals) return null;
  const total = cats.reduce((s, c) => s + (Number(vals[c]) || 0), 0);

  return (
    <>
      <h1>Budget limits</h1>
      <p className="sub">Set a monthly limit for the categories you want to watch. Leave a box empty for no limit. The Dashboard shows progress and warns you at 80%.</p>
      {msg && <div className="msg ok">{msg}</div>}
      <div className="grid">
        {cats.map((c) => (
          <label className="card field" key={c} style={{ margin: 0 }}>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{c}</span>
            <input type="number" min="0" step="10" placeholder={`Monthly limit (${cfg.base})`} value={vals[c] ?? ""} onChange={(e) => setVals({ ...vals, [c]: e.target.value })} />
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1.25rem" }}>
        <button className="btn" onClick={save}>Save limits</button>
        <span className="sub" style={{ margin: 0 }}>Total monthly limits: {cad(total)}</span>
      </div>
    </>
  );
}
