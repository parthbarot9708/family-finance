export const LOCKED_BANK = ["Salary", "CC Bill", "Int. Transfers"]; // the app relies on these names
export const LOCKED_CARD = ["CC Bill", "Int. Transfers"];
export const BANK_CATEGORIES = ["CC Bill","Education","GIC","Grocery/Utilities","Insurance","Int. Transfers","Loan","Others","Phone","Purchase","Rent","Ride Income","Salary","Tax","Transfers","Travel"];
export const CARD_CATEGORIES = ["Car Service","CC Bill","Education","Foods","Gas","GIC","Grocery/Utilities","Insurance","Int. Transfers","Loan","Others","Phone","Purchase","Rent","Ride Income","Salary","Tax","Transfers","Travel"];
export const BANKS = ["Scotiabank","CIBC","RBC","TD","BMO","Tangerine","Simplii","National Bank","Other"];
export const CARDS = ["AMEX","CIBC","Scotia","RBC","TD","BMO","Other"];
export const PRESETS = {
  CA: { label: "Canada", base: "CAD", second: "INR", bankCats: BANK_CATEGORIES, cardCats: CARD_CATEGORIES, banks: BANKS, cards: CARDS },
  IN: { label: "India", base: "INR", second: "CAD",
    bankCats: ["Salary","Business Income","Interest","Rent","EMI / Loan","Groceries","Utilities","Mobile & Internet","Fuel","Insurance","SIP / Investments","FD / RD","Education","Medical","Dining","Shopping","Travel","Entertainment","Family Support","Tax","CC Bill","Int. Transfers","Transfers","Others"],
    cardCats: ["Groceries","Dining","Fuel","Shopping","Travel","Entertainment","Medical","Utilities","Mobile & Internet","Insurance","Education","Subscriptions","CC Bill","Int. Transfers","Others"],
    banks: ["SBI","HDFC Bank","ICICI Bank","Axis Bank","Kotak Mahindra","Punjab National Bank","Bank of Baroda","Canara Bank","IDFC First","Other"],
    cards: ["HDFC","ICICI","SBI Card","Axis","Kotak","American Express","Other"] },
  OTHER: { label: "Other country", base: "USD", second: "EUR",
    bankCats: ["Salary","Other Income","Rent / Mortgage","Groceries","Utilities","Transport","Insurance","Loan Payment","Savings / Investments","Education","Health","Dining","Shopping","Travel","Entertainment","Taxes","CC Bill","Int. Transfers","Transfers","Others"],
    cardCats: ["Groceries","Dining","Transport","Shopping","Travel","Entertainment","Health","Utilities","Subscriptions","Education","CC Bill","Int. Transfers","Others"],
    banks: ["My bank"], cards: ["My card"] },
};
