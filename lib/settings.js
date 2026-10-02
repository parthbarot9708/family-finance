import { PRESETS } from "./categories";
export const CURRENCIES = {
  CAD: { locale: "en-CA", name: "Canadian dollars" }, INR: { locale: "en-IN", name: "Indian rupees" },
  USD: { locale: "en-US", name: "US dollars" }, GBP: { locale: "en-GB", name: "British pounds" },
  EUR: { locale: "de-DE", name: "Euros" }, AUD: { locale: "en-AU", name: "Australian dollars" },
  AED: { locale: "en-AE", name: "UAE dirhams" }, SGD: { locale: "en-SG", name: "Singapore dollars" },
};
const C = PRESETS.CA;
// Per-user settings, filled in once after login (see app/(app)/layout.js).
let cfg = { base: C.base, second: C.second, bankCats: C.bankCats, cardCats: C.cardCats, banks: C.banks, cards: C.cards };
export const getCfg = () => cfg;
export const setCfg = (p) => { cfg = { ...cfg, ...p }; };
export const profileToCfg = (p) => ({
  base: p.base_currency, second: p.second_currency,
  bankCats: p.bank_categories?.length ? p.bank_categories : C.bankCats, cardCats: p.card_categories?.length ? p.card_categories : C.cardCats,
  banks: p.banks?.length ? p.banks : C.banks, cards: p.cards?.length ? p.cards : C.cards,
});
