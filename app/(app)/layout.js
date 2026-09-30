"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";

const NAV = [
  ["/dashboard", "Dashboard"], ["/accounts", "Accounts"], ["/bank", "Bank transactions"],
  ["/cards", "Card transactions"], ["/salary", "Salary"], ["/budget", "Annual budget"],
  ["/projection", "Future projection"], ["/household", "Household"], ["/export", "Export"],
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => (data.session ? setUser(data.session.user) : router.replace("/login")));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => (s ? setUser(s.user) : router.replace("/login")));
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!user) return null;
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">Family Finance</div>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className={`nav ${path === href ? "on" : ""}`}>{label}</Link>
        ))}
        <div className="foot">
          <span>{user.user_metadata?.name || user.email}</span>
          <div style={{ display: "flex", gap: ".5rem" }}>
            <ThemeToggle />
            <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
