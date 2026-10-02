// Reads bank / credit card statement files (CSV or Excel rows) and finds the transactions.
// Everything runs in the browser. The file is never uploaded.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => { y = +y; m = +m; d = +d; return m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2100 ? `${y}-${pad(m)}-${pad(d)}` : null; };

export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const delim = [",", ";", "\t"].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

export function parseDate(v, order = "mdy") {
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") return v > 20000 && v < 80000 ? new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10) : null;
  let s = String(v ?? "").trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*([ap]m)?$/i, "");
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) return ymd(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return ymd(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return order === "dmy" ? ymd(y, m[2], m[1]) : ymd(y, m[1], m[2]); }
  if ((m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,9})\.?[-\/ ,]+(\d{2,4})$/))) { const mo = MONTHS[m[2].slice(0, 4).toLowerCase()] || MONTHS[m[2].slice(0, 3).toLowerCase()]; return mo ? ymd(m[3].length === 2 ? "20" + m[3] : m[3], mo, m[1]) : null; }
  if ((m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/))) { const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()]; return mo ? ymd(m[3], mo, m[2]) : null; }
  return null;
}

export function parseAmt(v) {
  if (typeof v === "number") return { n: v };
  let s = String(v ?? "").trim();
  if (!s || s === "-") return { n: null };
  let drcr = null;
  const t = s.match(/\b(cr|dr)\.?$/i);
  if (t) { drcr = t[1].toLowerCase(); s = s.replace(/\s*\b(cr|dr)\.?$/i, ""); }
  s = s.replace(/(rs|inr|cad|usd|\$|₹)\.?/gi, "").trim();
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
  s = s.replace(/[()\s+-]/g, "");
  if (!/^(\d{1,3}(,\d{2,3})*|\d+)?(\.\d+)?$/.test(s) || !/\d/.test(s)) return { n: null };
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? { n: null } : { n: neg ? -n : n, drcr };
}

const BANKS = [
  ["RBC", /description 1.*description 2|cheque number/], ["BMO", /first bank card|date posted/], ["American Express", /card member|amex|american express/],
  ["HDFC Bank", /narration.*chq|value dt|withdrawal amt/], ["ICICI Bank", /transaction remarks|withdrawal amount \(inr/], ["SBI", /txn date.*value date|ref no\.\/cheque/],
  ["Axis Bank", /particulars.*chqno|chqno/],
];

export function analyze(raw, { kind = "bank", flip = false, order = "auto", ov = {}, base = "CAD" } = {}) {
  const norm = raw.map((r) => r.map((c) => (c instanceof Date || typeof c === "number" ? c : String(c ?? "").trim())));
  const width = Math.max(0, ...norm.map((r) => r.length));
  let h = -1;
  for (let i = 0; i < Math.min(norm.length, 40); i++) {
    const cells = norm[i].map((c) => (typeof c === "string" ? c.toLowerCase() : ""));
    if (cells.some((c) => /date|dt$/.test(c) && c.length < 30) && cells.some((c) => /amount|debit|credit|withdraw|deposit|cad\$|^dr\.?$|^cr\.?$|balance/.test(c))) { h = i; break; }
  }
  const headers = h >= 0 ? Array.from({ length: width }, (_, i) => String(norm[h][i] ?? "")) : [];
  const lower = headers.map((x) => x.toLowerCase());
  const data = norm.slice(h + 1).filter((r) => r.some((c) => c !== ""));
  const label = (i) => (headers[i] ? headers[i] : `Column ${i + 1}`);
  const pick = (pats, skip = /^$/) => { for (const p of pats) { const i = lower.findIndex((x) => x && p.test(x) && !skip.test(x)); if (i >= 0) return i; } return -1; };
  const map = { date: -1, desc: [], debit: -1, credit: -1, amount: -1, type: -1 };
  if (h >= 0) {
    map.date = pick([/^(txn|transaction|trans\.?|tran|posted?|posting)\s*date/, /^date/, /date/], /value/);
    lower.forEach((x, i) => { if (x && /description|details|narration|particulars|memo|payee|remarks/.test(x) && !/type|code|date/.test(x)) map.desc.push(i); });
    map.debit = pick([/debit|withdraw|paid out|money out|^dr\.?$/], /balance|limit/);
    map.credit = pick([/credit|deposit|paid in|money in|^cr\.?$/], /balance|limit|card/);
    map.amount = pick([/^amount/, /amount$/, /^amt/, /cad\$/, /^inr/], /balance|debit|credit|withdraw|deposit/);
    map.type = pick([/^(dr ?\/ ?cr|cr ?\/ ?dr|debit\/credit)$/]);
  }
  const o = (k) => (ov[k] === "" || ov[k] == null ? null : Number(ov[k]));
  if (o("date") != null) map.date = o("date");
  if (o("desc") != null) map.desc = [o("desc")];
  if (o("debit") != null || o("credit") != null || o("amount") != null) { map.debit = o("debit") ?? -1; map.credit = o("credit") ?? -1; map.amount = o("amount") ?? -1; }
  const col = (i) => data.map((r) => r[i] ?? "");
  if (map.date < 0) {
    let best = -1, bs = 0.6;
    for (let i = 0; i < width; i++) { const v = col(i).filter((x) => x !== ""); const s = v.length ? v.filter((x) => parseDate(x, "mdy") || parseDate(x, "dmy")).length / v.length : 0; if (s > bs) { bs = s; best = i; } }
    map.date = best;
  }
  if (map.date < 0) return { rows: [], error: "I could not find a date column in this file. Open “Fix the columns” and choose it." };
  if (!map.desc.length) {
    let best = -1, bl = 0;
    for (let i = 0; i < width; i++) { if (i === map.date) continue; const v = col(i).filter((x) => typeof x === "string" && x !== "" && parseAmt(x).n == null && !parseDate(x)); const avg = v.length ? v.reduce((s, x) => s + x.length, 0) / v.length : 0; if (v.length > data.length * 0.3 && avg > bl) { bl = avg; best = i; } }
    if (best >= 0) map.desc = [best];
  }
  if (map.debit < 0 && map.credit < 0 && map.amount < 0) {
    const nums = [];
    for (let i = 0; i < width; i++) { if (i === map.date || map.desc.includes(i)) continue; if (col(i).filter((x) => parseAmt(x).n != null).length >= data.length * 0.3) nums.push(i); }
    if (nums.length >= 2) { map.debit = nums[0]; map.credit = nums[1]; } else if (nums.length === 1) map.amount = nums[0];
  }
  if (map.debit < 0 && map.credit < 0 && map.amount < 0) return { rows: [], error: "I could not find the amount columns. Open “Fix the columns” and choose them." };

  let ord = order;
  if (ord === "auto") {
    let a = false, b = false;
    col(map.date).forEach((x) => { const m = typeof x === "string" && x.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.]\d{2,4}/); if (m) { if (+m[1] > 12) a = true; if (+m[2] > 12) b = true; } });
    ord = a ? "dmy" : b ? "mdy" : base === "INR" ? "dmy" : "mdy";
  }
  const pair = map.debit >= 0 && map.credit >= 0;
  const entries = [];
  data.forEach((r) => {
    const date = parseDate(r[map.date], ord);
    if (!date) return;
    const desc = map.desc.map((i) => r[i]).filter((x) => x !== "" && x != null).join(" ").replace(/\s+/g, " ").trim().slice(0, 200) || "(no description)";
    if (pair) {
      const d = parseAmt(r[map.debit]).n, c = parseAmt(r[map.credit]).n;
      const expense = d ? Math.abs(d) : 0, income = c ? Math.abs(c) : 0;
      if (expense || income) entries.push({ date, desc, expense, income });
    } else if (map.amount < 0) {
      const only = map.debit >= 0 ? map.debit : map.credit, n = parseAmt(r[only]).n;
      if (n) entries.push({ date, desc, expense: map.debit >= 0 ? Math.abs(n) : 0, income: map.credit >= 0 ? Math.abs(n) : 0 });
    } else {
      const a = parseAmt(r[map.amount]);
      if (!a.n) return;
      const tv = map.type >= 0 ? String(r[map.type] ?? "").trim().toLowerCase() : "";
      entries.push({ date, desc, n: a.n, tag: a.drcr || (tv.startsWith("d") ? "dr" : tv.startsWith("c") ? "cr" : null) });
    }
  });
  const signed = entries.filter((e) => e.n != null);
  let negIsExpense = true;
  if (kind === "card") { const pos = signed.filter((e) => e.n > 0 && !e.tag).length, neg = signed.filter((e) => e.n < 0 && !e.tag).length; negIsExpense = !(pos >= neg); }
  if (flip) negIsExpense = !negIsExpense;
  const rows = entries.map((e) => {
    if (e.n == null) return e;
    const amt = Math.abs(e.n);
    const exp = e.tag ? e.tag === "dr" : e.n < 0 === negIsExpense;
    return { date: e.date, desc: e.desc, expense: exp ? amt : 0, income: exp ? 0 : amt };
  }).sort((a, b) => a.date.localeCompare(b.date));
  const sig = lower.join("|");
  const bank = (BANKS.find(([, re]) => re.test(sig)) || [])[0] || null;
  const used = [["Date", [map.date]], ["Description", map.desc], ["Money out", pair ? [map.debit] : map.amount >= 0 ? [map.amount] : [map.debit]], ["Money in", pair ? [map.credit] : map.amount >= 0 ? [map.amount] : [map.credit]]]
    .map(([k, ix]) => `${k}: ${ix.filter((i) => i >= 0).map(label).join(" + ") || "–"}`).join(" · ");
  return { rows, info: { bank, hasHeader: h >= 0, order: ord, used, labels: Array.from({ length: width }, (_, i) => label(i)) } };
}

const RULES = [
  [/payroll|salary|direct dep|payment from employer/i, /^salary$/i, "income"],
  [/payment.*thank|credit card pay|card payment|autopay|cc pay|bill payment.*card/i, /^cc bill$/i],
  [/no frills|walmart|loblaws|costco|metro|sobeys|freshco|food basics|farm boy|dmart|big ?bazaar|reliance (fresh|smart)|bigbasket|blinkit|zepto|instamart|grocer|supermarket|dollarama|shoppers/i, /groc/i],
  [/tim hortons|starbucks|mcdonald|subway|restaurant|uber eats|doordash|skip the|swiggy|zomato|pizza|cafe|coffee|burger|kfc|domino/i, /^(foods|dining)/i],
  [/petro|shell|esso|gas station|fuel|hpcl|bpcl|indian oil|pioneer|circle k/i, /^(gas|fuel)/i],
  [/rogers|bell |telus|fido|koodo|freedom mobile|airtel|jio|vodafone|bsnl|\bvi\b|mobile|internet/i, /phone|mobile/i],
  [/rent|landlord|lumina/i, /^rent/i],
  [/insur|lic of india|policy/i, /insur/i],
  [/\bcra\b|revenue agency|income tax|\btax\b|gst/i, /^tax/i],
  [/loan|emi\b|mortgage|finance/i, /loan|emi/i],
  [/uber|lyft|ttc|presto|go transit|ola cabs|metrolinx|rapido|irctc|air canada|westjet|indigo|makemytrip/i, /transport|travel/i],
  [/tuition|college|university|school|course|udemy|coursera/i, /educ/i],
  [/pharmacy|clinic|hospital|apollo|medical|dental/i, /medical|health/i],
  [/netflix|spotify|prime video|disney|youtube|subscription/i, /subscr|entertain/i],
  [/amazon|best buy|ikea|walmart\.com|flipkart|myntra|ajio|purchase/i, /purchase|shopping/i],
];
export function suggestCategory(desc, isIncome, cats) {
  for (const [re, catRe, only] of RULES) {
    if (only === "income" && !isIncome) continue;
    if (re.test(desc)) { const c = cats.find((x) => catRe.test(x)); if (c) return c; }
  }
  return cats.find((x) => /^others$/i.test(x)) || cats[0];
}
