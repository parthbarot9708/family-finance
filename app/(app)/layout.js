"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setCfg, profileToCfg } from "@/lib/settings";
import ThemeToggle from "@/components/ThemeToggle";
import "@/components/tx.css";

const NAV = [
  ["/dashboard", "Dashboard"], ["/accounts", "Accounts"], ["/bank", "Bank transactions"], ["/cards", "Card transactions"],
  ["/salary", "Salary"], ["/budget", "Annual budget"], ["/limits", "Budget limits"], ["/projection", "Projection & goals"],
  ["/household", "Household"], ["/export", "Export / Import"], ["/settings", "Settings"],
];

export default function AppLayout({ children }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = not set up yet
  const [later, setLater] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => (data.session ? setUser(data.session.user) : router.replace("/login")));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => (s ? setUser(s.user) : router.replace("/login")));
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => {
      if (data) { setCfg(profileToCfg(data)); setProfile(data); } else setProfile(null);
    });
  }, [user]);

  useEffect(() => { if (user) supabase.rpc("is_admin").then(({ data }) => setIsAdmin(data === true)); }, [user]);

  useEffect(() => { if (profile === null && path !== "/settings") router.replace("/settings"); }, [profile, path, router]);

  if (!user || profile === undefined || (profile === null && path !== "/settings")) return null;
  const days = profile?.last_backup ? Math.floor((Date.now() - new Date(profile.last_backup)) / 864e5) : null;
  const age = profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at)) / 864e5) : 0;
  const due = profile && !later && ((days === null && age >= 7) || (days !== null && days >= 30));

  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">Family Finance</div>
        {(isAdmin ? [...NAV, ["/admin", "Admin"]] : NAV).map(([href, label]) => <Link key={href} href={href} className={`nav ${path === href ? "on" : ""}`}>{label}</Link>)}
        <div className="foot">
          <span>{user.user_metadata?.name || user.email}</span>
          <div style={{ display: "flex", gap: ".5rem" }}>
            <ThemeToggle />
            <button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </nav>
      <main className="main">
        {due && (
          <div className="banner">
            <span>Time for your monthly backup. {days === null ? "You have not downloaded one yet." : `Your last backup was ${days} days ago.`}</span>
            <Link className="btn sm" href="/export">Download backup</Link>
            <button className="btn ghost sm" onClick={() => setLater(true)}>Later</button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
