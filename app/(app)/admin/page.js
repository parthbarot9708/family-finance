"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import "@/components/tx.css";

const day = 864e5;
const ago = (d) => { if (!d) return "Never"; const n = Math.floor((Date.now() - new Date(d)) / day); return n <= 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`; };
const dt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "–");

export default function Admin() {
  const [state, setState] = useState("loading");
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState(null);

  async function load() {
    const { data, error } = await supabase.rpc("admin_users");
    if (error) { setState("denied"); return; }
    setRows(data || []); setState("ok");
  }
  useEffect(() => { load(); }, []);

  async function run(fn, args, okText) {
    const { error } = await supabase.rpc(fn, args);
    setMsg(error ? { ok: false, t: error.message } : { ok: true, t: okText });
    load();
  }
  const suspend = (u, on) => confirm(`${on ? "Suspend" : "Reactivate"} ${u.email}?`) && run("admin_set_ban", { p_user: u.uid, p_ban: on }, on ? "User suspended. They can no longer sign in." : "User reactivated.");
  const remove = (u) => prompt(`This permanently deletes ${u.email} and ALL their data. Type DELETE to confirm.`) === "DELETE" && run("admin_delete_user", { p_user: u.uid }, "User deleted.");

  if (state === "loading") return null;
  if (state === "denied") return (<><h1>Admin</h1><p className="sub">This page is only available to the site administrator.</p></>);

  const now = Date.now();
  const list = rows.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const stat = (label, v, sub) => <div className="card stat"><small>{label}</small><h2>{v}</h2>{sub && <small>{sub}</small>}</div>;

  return (
    <>
      <h1>Admin</h1>
      <p className="sub">Who uses the platform and how much. You can see basic account details and counts, never amounts, descriptions or notes.</p>
      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.t}</div>}
      <div className="grid">
        {stat("Total users", rows.length, `${rows.filter((r) => !r.confirmed).length} unconfirmed`)}
        {stat("Active in last 30 days", rows.filter((r) => r.last_login && now - new Date(r.last_login) < 30 * day).length)}
        {stat("Joined in last 30 days", rows.filter((r) => now - new Date(r.joined) < 30 * day).length)}
        {stat("Total entries", rows.reduce((s, r) => s + Number(r.entries_count), 0).toLocaleString(), `${rows.reduce((s, r) => s + Number(r.accounts_count), 0)} accounts`)}
        {stat("Canada / India", `${rows.filter((r) => r.country === "CA").length} / ${rows.filter((r) => r.country === "IN").length}`, `${rows.filter((r) => !r.country).length} not set up yet`)}
      </div>

      <div style={{ maxWidth: 340, marginTop: "1rem" }}>
        <input className="sel" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>User</th><th>Country</th><th>Currency</th><th>Joined</th><th>Last login</th><th className="num">Accounts</th><th className="num">Entries</th><th>Last entry</th><th>Last backup</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={11} style={{ color: "var(--muted)" }}>No users match.</td></tr>}
            {list.map((u) => (
              <tr key={u.uid}>
                <td className="txt"><strong>{u.name || "–"}</strong>{u.is_admin_user && <span className="chip" style={{ marginLeft: ".4rem" }}>Admin</span>}<br /><small style={{ color: "var(--muted)" }}>{u.email}</small></td>
                <td className="nw">{u.country === "CA" ? "Canada" : u.country === "IN" ? "India" : u.country ? "Other" : "–"}</td>
                <td className="nw">{u.base_currency ? `${u.base_currency} → ${u.second_currency}` : "–"}</td>
                <td className="dt">{dt(u.joined)}</td>
                <td className="nw">{ago(u.last_login)}</td>
                <td className="num">{u.accounts_count}</td>
                <td className="num">{u.entries_count}</td>
                <td className="dt">{dt(u.last_entry_date)}</td>
                <td className="nw">{ago(u.last_backup)}</td>
                <td className="nw"><span className={u.suspended ? "neg" : !u.confirmed ? "" : "pos"}>{u.suspended ? "Suspended" : !u.confirmed ? "Unconfirmed" : "Active"}</span></td>
                <td className="nw">
                  {!u.is_admin_user && (
                    <>
                      <button className="btn ghost sm" onClick={() => suspend(u, !u.suspended)}>{u.suspended ? "Reactivate" : "Suspend"}</button>{" "}
                      <button className="x" title="Delete user and all data" aria-label="Delete user" onClick={() => remove(u)}>✕</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
