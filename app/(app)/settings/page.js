"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PRESETS, LOCKED_BANK, LOCKED_CARD } from "@/lib/categories";
import { CURRENCIES } from "@/lib/settings";
import "@/components/tx.css";

function ListEditor({ title, note, items, setItems, locked = [] }) {
  const [v, setV] = useState("");
  const add = () => {
    const t = v.trim();
    if (!t || items.some((i) => i.toLowerCase() === t.toLowerCase())) return;
    setItems([...items, t]); setV("");
  };
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3>{title}</h3>
      {note && <p className="sub" style={{ margin: ".25rem 0 0", fontSize: ".85rem" }}>{note}</p>}
      <div className="chips">
        {items.map((i) => (
          <span className="chip" key={i}>{i}{!locked.includes(i) && <button type="button" aria-label={`Remove ${i}`} onClick={() => setItems(items.filter((x) => x !== i))}>✕</button>}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: ".5rem", maxWidth: 420 }}>
        <input className="sel" value={v} placeholder="Add new…" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn ghost" onClick={add}>Add</button>
      </div>
    </div>
  );
}

const fromPreset = (k) => { const p = PRESETS[k]; return { preset: k, base: p.base, second: p.second, bankCats: [...p.bankCats], cardCats: [...p.cardCats], banks: [...p.banks], cards: [...p.cards] }; };

export default function Settings() {
  const [ready, setReady] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [orig, setOrig] = useState(null);
  const [s, setS] = useState(fromPreset("CA"));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const up = (k) => (v) => setS((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => {
      if (data) {
        const v = { preset: data.country || "CA", base: data.base_currency, second: data.second_currency, bankCats: data.bank_categories || [], cardCats: data.card_categories || [], banks: data.banks || [], cards: data.cards || [] };
        setS(v); setOrig(v);
      } else setIsNew(true);
      setReady(true);
    });
  }, []);

  function pickPreset(k) {
    if (!isNew && !confirm("Replace your current categories, banks and cards with the defaults for this country?")) return;
    setS(fromPreset(k));
  }
  async function save() {
    setBusy(true); setMsg(null);
    if (s.base === s.second) { setMsg({ ok: false, t: "Your home currency and comparison currency must be different." }); setBusy(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id, country: s.preset, base_currency: s.base, second_currency: s.second,
      bank_categories: [...new Set([...s.bankCats, ...LOCKED_BANK])], card_categories: [...new Set([...s.cardCats, ...LOCKED_CARD])],
      banks: s.banks.length ? s.banks : ["Other"], cards: s.cards.length ? s.cards : ["Other"],
    });
    if (error) { setMsg({ ok: false, t: error.message }); setBusy(false); return; }
    window.location.href = "/dashboard";
  }
  if (!ready) return null;
  const changed = orig && (orig.base !== s.base || orig.second !== s.second);
  const cur = (v, k) => (
    <select className="sel" value={v} onChange={(e) => up(k)(e.target.value)}>
      {Object.entries(CURRENCIES).map(([c, o]) => <option key={c} value={c}>{c} – {o.name}</option>)}
    </select>
  );

  return (
    <>
      <h1>{isNew ? "Welcome! Set up your finances" : "Settings"}</h1>
      <p className="sub">Choose your country, your currencies, and the categories, banks and cards you use. You can change this any time.</p>
      {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.t}</div>}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="form-row">
          <label>Country defaults<select className="sel" value={s.preset} onChange={(e) => pickPreset(e.target.value)}>{Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></label>
          <label>Home currency (your accounts){cur(s.base, "base")}</label>
          <label>Compare with (second currency){cur(s.second, "second")}</label>
        </div>
        <p className="sub" style={{ margin: ".75rem 0 0", fontSize: ".85rem" }}>
          Amounts are entered in your home currency. Each entry also saves that day's exchange rate to the second currency, so you can see both.
        </p>
        {changed && <div className="msg err" style={{ marginTop: ".75rem" }}>Changing currencies after you have entered data makes the saved exchange rates inaccurate. Do this only if you are starting fresh.</div>}
      </div>
      <ListEditor title="Bank transaction categories" note="Salary, CC Bill and Int. Transfers are built in and cannot be removed." items={s.bankCats} setItems={up("bankCats")} locked={LOCKED_BANK} />
      <ListEditor title="Card transaction categories" note="CC Bill and Int. Transfers are built in." items={s.cardCats} setItems={up("cardCats")} locked={LOCKED_CARD} />
      <ListEditor title="Banks" items={s.banks} setItems={up("banks")} />
      <ListEditor title="Credit cards" items={s.cards} setItems={up("cards")} />
      <button className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : isNew ? "Save and continue" : "Save settings"}</button>
      {!isNew && <p className="sub" style={{ marginTop: ".75rem", fontSize: ".85rem" }}>Removing a category does not change entries you already saved with it.</p>}
    </>
  );
}
