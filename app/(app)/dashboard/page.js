export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>
      <p className="sub">Your totals, monthly costs and savings tips will appear here once you add transactions.</p>
      <div className="grid">
        {["Income", "Expenses", "Balance"].map((t) => (
          <div className="card" key={t}><div style={{ color: "var(--muted)" }}>{t}</div><h2>$0.00</h2></div>
        ))}
      </div>
    </>
  );
}
