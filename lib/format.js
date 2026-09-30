export const cad = (n) => Number(n || 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
export const inr = (n) => Number(n || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
