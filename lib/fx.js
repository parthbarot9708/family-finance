import { getCfg } from "./settings";
// Rate = units of the comparison currency per 1 unit of the home currency, on a given day (Frankfurter / ECB).
// Stored in the database column fx_rate_inr (the column name is historical).
const cache = {};
export async function getRate(date) {
  const { base, second } = getCfg();
  if (base === second) return 1;
  const today = new Date().toISOString().slice(0, 10);
  const d = !date || date >= today ? "latest" : date;
  const key = `${base}${second}${d}`;
  if (cache[key]) return cache[key];
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/${d}?base=${base}&symbols=${second}`);
    const j = await r.json();
    const v = j.rates?.[second] ?? null;
    if (v) cache[key] = v;
    return v;
  } catch { return null; }
}
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export async function getRates(dates) {
  const { base, second } = getCfg();
  const today = new Date().toISOString().slice(0, 10);
  const ds = [...new Set(dates)].sort();
  const out = {};
  if (!ds.length) return out;
  if (base === second) { ds.forEach((d) => (out[d] = 1)); return out; }
  const all = {};
  let i = 0;
  while (i < ds.length) {
    const from = addDays(ds[i], -5), to = addDays(ds[i], 80);
    let j = i;
    while (j < ds.length && ds[j] <= to) j++;
    const last = ds[j - 1];
    const end = last >= today ? addDays(today, -1) : last;
    try {
      const r = await fetch(`https://api.frankfurter.dev/v1/${from}..${end}?base=${base}&symbols=${second}`);
      const js = await r.json();
      for (const [k, v] of Object.entries(js.rates || {})) all[k] = v[second];
    } catch {}
    i = j;
  }
  const keys = Object.keys(all).sort();
  const latest = await getRate();
  for (const d of ds) {
    if (d >= today) { out[d] = latest; continue; }
    let pick = null;
    for (const k of keys) { if (k <= d) pick = k; else break; }
    out[d] = pick ? all[pick] : keys.length ? all[keys[0]] : latest;
  }
  return out;
}
