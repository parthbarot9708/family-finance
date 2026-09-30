"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Household() {
  const [rows, setRows] = useState(null);
  const [code, setCode] = useState("");
  const [join, setJoin] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    setName((n) => n || user?.user_metadata?.name || "");
    const { data } = await supabase.rpc("household_summary");
    setRows(data || []);
    const { data: h } = await supabase.from("households").select("invite_code").limit(1);
    setCode(h?.[0]?.invite_code || "");
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setError("");
    const { error } = await supabase.rpc("create_household", { p_name: name || "Me" });
    error ? setError(error.message) : load();
  }
  async function joinIt() {
    setError("");
    const { error } = await supabase.rpc("join_household", { p_code: join.trim(), p_name: name || "Me" });
    error ? setError(error.message) : load();
  }

  if (!rows) return null;
  const money = (n) => Number(n).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
  return (
    <>
      <h1>Household</h1>
      <p className="sub">See each other's overall income and expenses. Detailed transactions stay private.</p>
      {error && <div className="msg err">{error}</div>}
      {rows.length === 0 ? (
        <div className="grid">
          <div className="card">
            <h3>Start a household</h3>
            <p className="sub">Create it, then share the invite code with your wife.</p>
            <label className="field">Your display name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <button className="btn" onClick={create}>Create household</button>
          </div>
          <div className="card">
            <h3>Join with a code</h3>
            <p className="sub">Enter the code your partner shared.</p>
            <label className="field">Invite code<input value={join} onChange={(e) => setJoin(e.target.value)} /></label>
            <button className="btn" onClick={joinIt}>Join household</button>
          </div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            Invite code: <strong>{code}</strong>
          </div>
          <div className="grid">
            {rows.map((r) => (
              <div className="card" key={r.user_id}>
                <h3>{r.display_name}</h3>
                <p style={{ color: "var(--good)" }}>Income {money(r.total_income)}</p>
                <p style={{ color: "var(--bad)" }}>Expenses {money(r.total_expense)}</p>
              </div>
            ))}
            <div className="card">
              <h3>Combined</h3>
              <p style={{ color: "var(--good)" }}>Income {money(rows.reduce((s, r) => s + Number(r.total_income), 0))}</p>
              <p style={{ color: "var(--bad)" }}>Expenses {money(rows.reduce((s, r) => s + Number(r.total_expense), 0))}</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
