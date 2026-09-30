// CAD -> INR rate for a given day (Frankfurter / European Central Bank). Weekends use the last business day.
const cache = {};
export async function getRate(date) {
  const today = new Date().toISOString().slice(0, 10);
  const d = !date || date >= today ? "latest" : date;
  if (cache[d]) return cache[d];
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/${d}?base=CAD&symbols=INR`);
    const j = await r.json();
    const v = j.rates?.INR ?? null;
    if (v) cache[d] = v;
    return v;
  } catch {
    return null;
  }
}

// Many dates at once (used by Excel import): daily CAD->INR rates, weekends use the previous business day.
const addDays = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export async function getRates(dates) {
  const today = new Date().toISOString().slice(0, 10);
  const ds = [...new Set(dates)].sort();
  const out = {};
  if (!ds.length) return out;
  const all = {};
  let i = 0;
  while (i < ds.length) {
    const from = addDays(ds[i], -5), to = addDays(ds[i], 80);
    let j = i;
    while (j < ds.length && ds[j] <= to) j++;
    const last = ds[j - 1];
    const end = last >= today ? addDays(today, -1) : last;
    try {
      const r = await fetch(`https://api.frankfurter.dev/v1/${from}..${end}?base=CAD&symbols=INR`);
      const js = await r.json();
      for (const [k, v] of Object.entries(js.rates || {})) all[k] = v.INR;
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
