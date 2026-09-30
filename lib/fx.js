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
