import { getCfg, CURRENCIES } from "./settings";
const money = (n, c, d) => Number(n || 0).toLocaleString(CURRENCIES[c]?.locale || "en-US", { style: "currency", currency: c, minimumFractionDigits: d, maximumFractionDigits: d });
// cad() = home currency, inr() = comparison currency (names kept so every page keeps working)
export const cad = (n) => money(n, getCfg().base, 2);
export const inr = (n) => money(n, getCfg().second, getCfg().second === "INR" ? 0 : 2);
